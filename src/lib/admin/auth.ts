import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { AdminRole } from "@/lib/admin/types";

const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  operator: 2,
  superadmin: 3,
};

function parseBootstrapEmails(): Set<string> {
  const raw = process.env.ADMIN_BOOTSTRAP_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function getAdminRole(userId: string, email?: string | null): Promise<AdminRole | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("admin_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data?.role) {
      return data.role as AdminRole;
    }
  } catch {
    // Fall through to bootstrap emails when service role is unavailable.
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && parseBootstrapEmails().has(normalizedEmail)) {
    return "superadmin";
  }

  return null;
}

export async function requireAdminPage(minRole: AdminRole = "viewer"): Promise<{
  userId: string;
  email: string | null;
  role: AdminRole;
}> {
  const user = await getUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  const role = await getAdminRole(user.id, user.email);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    redirect("/platform/audit");
  }

  return { userId: user.id, email: user.email ?? null, role };
}

export async function requireAdminApi(minRole: AdminRole = "viewer") {
  const user = await getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = await getAdminRole(user.id, user.email);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, role };
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
