import { createAdminClient } from "@/lib/supabase/admin";
import { getGodModeEmails, isGodModeEmail } from "@/lib/admin/auth-role";
import type { AdminRole } from "@/lib/admin/types";

export interface AdminTeamMember {
  userId: string | null;
  email: string;
  fullName: string | null;
  role: AdminRole | "god_mode";
  isGodMode: boolean;
  grantedAt: string | null;
  grantedByEmail: string | null;
}

const MANAGEABLE_ROLES = new Set<AdminRole>(["viewer", "operator"]);

export async function listAdminTeamMembers(): Promise<AdminTeamMember[]> {
  const supabase = createAdminClient();
  const godModeEmails = getGodModeEmails();

  const { data: adminRows, error } = await supabase
    .from("admin_users")
    .select("user_id, role, granted_by, created_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to list admin team: ${error.message}`);

  const rows = adminRows ?? [];
  const userIds = rows.map((row) => row.user_id as string);
  const grantorIds = [
    ...new Set(rows.map((row) => row.granted_by).filter(Boolean)),
  ] as string[];

  const profileIds = [...new Set([...userIds, ...grantorIds])];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", profileIds)
    : { data: [] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id as string,
      {
        email: (profile.email as string | null) ?? null,
        fullName: (profile.full_name as string | null) ?? null,
      },
    ])
  );

  const members: AdminTeamMember[] = [];
  const seenEmails = new Set<string>();

  for (const email of godModeEmails) {
    seenEmails.add(email);
    const profile = [...profileById.entries()].find(
      ([, value]) => value.email?.toLowerCase() === email
    );
    members.push({
      userId: profile?.[0] ?? null,
      email,
      fullName: profile?.[1].fullName ?? null,
      role: "god_mode",
      isGodMode: true,
      grantedAt: null,
      grantedByEmail: null,
    });
  }

  for (const row of rows) {
    const userId = row.user_id as string;
    const profile = profileById.get(userId);
    const email = profile?.email?.toLowerCase() ?? null;
    if (email && isGodModeEmail(email)) continue;

    members.push({
      userId,
      email: profile?.email ?? userId,
      fullName: profile?.fullName ?? null,
      role: row.role as AdminRole,
      isGodMode: false,
      grantedAt: row.created_at as string,
      grantedByEmail: row.granted_by
        ? profileById.get(row.granted_by as string)?.email ?? null
        : null,
    });
    if (email) seenEmails.add(email);
  }

  return members.sort((a, b) => {
    if (a.isGodMode && !b.isGodMode) return -1;
    if (!a.isGodMode && b.isGodMode) return 1;
    return a.email.localeCompare(b.email);
  });
}

async function findUserIdByEmail(email: string): Promise<{
  userId: string;
  fullName: string | null;
} | null> {
  const supabase = createAdminClient();
  const normalized = email.trim().toLowerCase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id) {
    return {
      userId: profile.id as string,
      fullName: (profile.full_name as string | null) ?? null,
    };
  }

  const { data: authData, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) return null;

  const authUser = authData.users.find(
    (user) => user.email?.trim().toLowerCase() === normalized
  );
  if (!authUser) return null;

  return {
    userId: authUser.id,
    fullName: (authUser.user_metadata?.full_name as string | undefined) ?? null,
  };
}

export async function addAdminTeamMember(input: {
  email: string;
  role: AdminRole;
  grantedBy: string;
}): Promise<AdminTeamMember> {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required");
  if (isGodModeEmail(normalizedEmail)) {
    throw new Error("This email already has god-mode access via environment configuration");
  }
  if (!MANAGEABLE_ROLES.has(input.role)) {
    throw new Error("Role must be viewer or operator");
  }

  const user = await findUserIdByEmail(normalizedEmail);
  if (!user) {
    throw new Error("No user found with that email. They must sign up first.");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_users")
    .upsert(
      {
        user_id: user.userId,
        role: input.role,
        granted_by: input.grantedBy,
      },
      { onConflict: "user_id" }
    )
    .select("user_id, role, granted_by, created_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to add team member: ${error?.message ?? "Unknown error"}`);
  }

  const grantor = await supabase
    .from("profiles")
    .select("email")
    .eq("id", input.grantedBy)
    .maybeSingle();

  return {
    userId: data.user_id as string,
    email: normalizedEmail,
    fullName: user.fullName,
    role: data.role as AdminRole,
    isGodMode: false,
    grantedAt: data.created_at as string,
    grantedByEmail: (grantor.data?.email as string | null) ?? null,
  };
}

export async function updateAdminTeamMemberRole(input: {
  userId: string;
  role: AdminRole;
}): Promise<void> {
  if (!MANAGEABLE_ROLES.has(input.role)) {
    throw new Error("Role must be viewer or operator");
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (!existing) throw new Error("Team member not found");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", input.userId)
    .maybeSingle();

  if (isGodModeEmail(profile?.email)) {
    throw new Error("God-mode accounts cannot be modified");
  }

  const { error } = await supabase
    .from("admin_users")
    .update({ role: input.role })
    .eq("user_id", input.userId);

  if (error) throw new Error(`Failed to update role: ${error.message}`);
}

export async function removeAdminTeamMember(userId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (isGodModeEmail(profile?.email)) {
    throw new Error("God-mode accounts cannot be removed from the UI");
  }

  const { error } = await supabase.from("admin_users").delete().eq("user_id", userId);
  if (error) throw new Error(`Failed to remove team member: ${error.message}`);
}
