import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  DeltaBadge,
  formatRelativeDate,
  GradeBadge,
  StatusBadge,
} from "@/components/admin/AdminBadges";
import BusinessListCell from "@/components/admin/BusinessListCell";
import { ChurnRiskBadge, HealthIndexBadge } from "@/components/admin/IntelligenceBadges";
import SegmentPills from "@/components/admin/SegmentPills";
import UserFilters from "@/components/admin/UserFilters";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import type { AdminSegmentId } from "@/lib/admin/segments";
import { getAllUserSummaries, listAdminUsers } from "@/lib/admin/users";
import type { HealthGrade } from "@/audit/types";
import type { UserStatus } from "@/lib/admin/types";

export const metadata: Metadata = {
  title: "Users | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    grade?: string;
    status?: string;
    segment?: string;
    page?: string;
  }>;
}

function buildUsersHref(params: {
  q?: string;
  grade?: string;
  status?: string;
  segment?: string;
  page: number;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.grade && params.grade !== "all") search.set("grade", params.grade);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.segment && params.segment !== "all") search.set("segment", params.segment);
  if (params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { userId } = await requireAdminPage("viewer");
  const params = await searchParams;

  const q = params.q?.trim();
  const grade = (params.grade ?? "all") as HealthGrade | "all";
  const status = (params.status ?? "all") as UserStatus | "all";
  const segment = (params.segment ?? "all") as AdminSegmentId | "all";
  const page = Math.max(1, Number(params.page ?? "1"));

  const [result, allUsers] = await Promise.all([
    listAdminUsers({ q, grade, status, segment, page }),
    getAllUserSummaries(),
  ]);

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "users",
    metadata: { q, grade, status, segment, page },
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Users</p>
        <h1 className="mt-2 text-3xl font-bold text-white">User directory</h1>
        <p className="mt-2 text-[#94a3b8]">
          {result.total} user{result.total === 1 ? "" : "s"} matching your filters.
        </p>
      </div>

      <div className="mb-6 space-y-4 rounded-xl border border-[#2d3348] bg-[#151923] p-4">
        <SegmentPills users={allUsers} activeSegment={segment} />
        <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-[#1e2433]" />}>
          <UserFilters />
        </Suspense>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2d3348] bg-[#151923]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#1a1f2e] text-[#64748b]">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Churn risk</th>
                <th className="px-4 py-3 font-medium">Locations</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Tasks</th>
                <th className="px-4 py-3 font-medium">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {result.users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#64748b]">
                    No users match these filters.
                  </td>
                </tr>
              ) : (
                result.users.map((user) => (
                  <tr key={user.userId} className="border-t border-[#2d3348]/60 hover:bg-[#1a1f2e]/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user.userId}`}
                        className="block font-medium text-white hover:text-[#a5b4fc]"
                      >
                        {user.fullName || user.email || "Unnamed user"}
                      </Link>
                      {user.fullName && user.email ? (
                        <p className="text-xs text-[#64748b]">{user.email}</p>
                      ) : null}
                      <div className="mt-1">
                        <StatusBadge status={user.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <HealthIndexBadge index={user.healthIndex} />
                    </td>
                    <td className="px-4 py-3">
                      <ChurnRiskBadge risk={user.churnRisk} level={user.churnRiskLevel} />
                    </td>
                    <td className="px-4 py-3">
                      <BusinessListCell
                        businesses={user.businesses}
                        onboardedCount={user.onboardedCount}
                        businessCount={user.businessCount}
                        gbpConnectedCount={user.gbpConnectedCount}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{user.avgScore ?? "—"}</span>
                        <GradeBadge grade={user.grade} />
                      </div>
                      <div className="mt-1">
                        <DeltaBadge delta={user.scoreDelta7d} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#cbd5e1]">
                      <span className="text-amber-400">{user.pendingTasks}</span>
                      <span className="text-[#64748b]"> / </span>
                      <span className="text-emerald-400">{user.completedTasks}</span>
                      {user.failedTasks > 0 ? (
                        <span className="mt-0.5 block text-xs text-red-400">{user.failedTasks} failed</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8]">{formatRelativeDate(user.lastAuditAt)}</td>
                  </tr>
                ))
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
                  href={buildUsersHref({ q, grade, status, segment, page: page - 1 })}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e2433]"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildUsersHref({ q, grade, status, segment, page: page + 1 })}
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
