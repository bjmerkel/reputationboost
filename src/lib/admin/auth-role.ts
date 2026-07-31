import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/admin/types";

export const ROLE_RANK: Record<AdminRole, number> = {
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

export function canManageOnBehalf(role: AdminRole | null): boolean {
  return role === "operator" || role === "superadmin";
}
