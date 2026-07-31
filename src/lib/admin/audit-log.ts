import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminAuditLogEntry {
  id: string;
  adminUserId: string | null;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminAuditLogResult {
  entries: AdminAuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListAdminAuditLogOptions {
  page?: number;
  pageSize?: number;
  action?: string;
  adminUserId?: string;
}

const PAGE_SIZE_DEFAULT = 50;

export function formatAuditAction(action: string): string {
  return action.replaceAll("_", " ");
}

export async function listAdminAuditLog(
  options: ListAdminAuditLogOptions = {}
): Promise<AdminAuditLogResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? PAGE_SIZE_DEFAULT));
  const supabase = createAdminClient();

  let query = supabase
    .from("admin_audit_log")
    .select("id, admin_user_id, action, target_type, target_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (options.action && options.action !== "all") {
    query = query.eq("action", options.action);
  }
  if (options.adminUserId) {
    query = query.eq("admin_user_id", options.adminUserId);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw new Error(`Failed to list audit log: ${error.message}`);

  const rows = data ?? [];
  const adminIds = [...new Set(rows.map((row) => row.admin_user_id).filter(Boolean))] as string[];

  const emailById = new Map<string, string>();
  if (adminIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", adminIds);
    for (const profile of profiles ?? []) {
      if (profile.email) emailById.set(profile.id, profile.email);
    }
  }

  const entries: AdminAuditLogEntry[] = rows.map((row) => ({
    id: row.id as string,
    adminUserId: (row.admin_user_id as string | null) ?? null,
    adminEmail: row.admin_user_id ? emailById.get(row.admin_user_id as string) ?? null : null,
    action: row.action as string,
    targetType: (row.target_type as string | null) ?? null,
    targetId: (row.target_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }));

  return {
    entries,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function listRecentAdminActivity(limit = 20): Promise<AdminAuditLogEntry[]> {
  const result = await listAdminAuditLog({ page: 1, pageSize: limit });
  return result.entries;
}

export async function listDistinctAuditActions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return [];
  return [...new Set((data ?? []).map((row) => row.action as string))].sort();
}
