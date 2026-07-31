import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminRole, isGodModeEmail, ROLE_RANK } from "@/lib/admin/auth-role";
import { getSessionUser } from "@/lib/supabase/server";
import type { AdminRole } from "@/lib/admin/types";

export { getAdminRole, canManageOnBehalf, canManageAdminTeam, isGodModeEmail, ROLE_RANK } from "@/lib/admin/auth-role";

export async function requireAdminPage(minRole: AdminRole = "viewer"): Promise<{
  userId: string;
  email: string | null;
  role: AdminRole;
  isGodMode: boolean;
}> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  const role = await getAdminRole(user.id, user.email);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    redirect("/platform/audit");
  }

  return { userId: user.id, email: user.email ?? null, role, isGodMode: isGodModeEmail(user.email) };
}

export async function requireGodModePage(): Promise<{
  userId: string;
  email: string | null;
  role: AdminRole;
  isGodMode: true;
}> {
  const session = await requireAdminPage("superadmin");
  if (!session.isGodMode) {
    redirect("/admin");
  }
  return { ...session, isGodMode: true };
}

export async function requireAdminApi(minRole: AdminRole = "viewer") {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = await getAdminRole(user.id, user.email);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, role, isGodMode: isGodModeEmail(user.email) };
}

export async function requireGodModeApi() {
  const auth = await requireAdminApi("superadmin");
  if (auth.error) return auth;
  if (!auth.isGodMode) {
    return { error: NextResponse.json({ error: "God mode required" }, { status: 403 }) };
  }
  return auth;
}

export async function logAdminAction(input: {
  adminUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("admin_audit_log").insert({
      admin_user_id: input.adminUserId,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Audit logging should not block admin operations.
  }
}
