import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatRelativeDate } from "@/components/admin/AdminBadges";
import AuditLogFilters from "@/components/admin/AuditLogFilters";
import { formatAuditAction, listAdminAuditLog } from "@/lib/admin/audit-log";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Audit log | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ action?: string; page?: string }>;
}

function buildAuditHref(params: { action?: string; page: number }): string {
  const search = new URLSearchParams();
  if (params.action && params.action !== "all") search.set("action", params.action);
  if (params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/admin/audit-log?${query}` : "/admin/audit-log";
}

function targetHref(targetType: string | null, targetId: string | null): string | null {
  if (!targetType || !targetId) return null;
  if (targetType === "user") return `/admin/users/${targetId}`;
  if (targetType === "business") return `/admin/businesses/${targetId}`;
  if (targetType === "task" && targetId !== "bulk") return `/admin/tasks`;
  if (targetType === "admin" && targetId === "audit_log") return "/admin/audit-log";
  return null;
}

export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  const { userId } = await requireAdminPage("viewer");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));
  const action = params.action ?? "all";

  const result = await listAdminAuditLog({ page, action });

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "audit_log",
    metadata: { page, action },
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Audit log</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Admin activity</h1>
        <p className="mt-2 text-[#94a3b8]">
          Full history of admin actions — page views, notes, impersonation, task approvals, and playbook steps.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-[#2d3348] bg-[#151923] p-4">
        <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-[#1e2433]" />}>
          <AuditLogFilters />
        </Suspense>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2d3348] bg-[#151923]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#1a1f2e] text-[#64748b]">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#64748b]">
                    No audit log entries match these filters.
                  </td>
                </tr>
              ) : (
                result.entries.map((entry) => {
                  const href = targetHref(entry.targetType, entry.targetId);
                  const metadataPreview = Object.keys(entry.metadata).length
                    ? JSON.stringify(entry.metadata)
                    : "—";

                  return (
                    <tr key={entry.id} className="border-t border-[#2d3348]/60 hover:bg-[#1a1f2e]/60">
                      <td className="px-4 py-3 text-[#64748b]">
                        {formatRelativeDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-[#cbd5e1]">
                        {entry.adminEmail ?? entry.adminUserId ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {formatAuditAction(entry.action)}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8]">
                        {href ? (
                          <Link href={href} className="hover:text-[#a5b4fc]">
                            {entry.targetType} / {entry.targetId}
                          </Link>
                        ) : entry.targetType ? (
                          `${entry.targetType}${entry.targetId ? ` / ${entry.targetId}` : ""}`
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-xs text-[#64748b]">
                        {metadataPreview}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[#2d3348] px-4 py-3 text-sm">
            <span className="text-[#64748b]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildAuditHref({ action, page: page - 1 })}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e2433]"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildAuditHref({ action, page: page + 1 })}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e2433]"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
