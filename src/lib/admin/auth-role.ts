import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole } from "@/lib/admin/types";

export const ROLE_RANK: Record<AdminRole, number> = {
  viewer: 1,
  operator: 2,
  superadmin: 3,
};

/** Emails with permanent god-mode access (env `ADMIN_BOOTSTRAP_EMAILS`). */
export function getGodModeEmails(): Set<string> {
  const raw = process.env.ADMIN_BOOTSTRAP_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isGodModeEmail(email?: string | null): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return getGodModeEmails().has(normalized);
}

export async function getAdminRole(userId: string, email?: string | null): Promise<AdminRole | null> {
  if (isGodModeEmail(email)) {
    return "superadmin";
  }

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
    // Fall through when service role is unavailable.
  }

  return null;
}

export function canManageOnBehalf(role: AdminRole | null): boolean {
  return role === "operator" || role === "superadmin";
}

export function canManageAdminTeam(email?: string | null): boolean {
  return isGodModeEmail(email);
}
