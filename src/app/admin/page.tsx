import type { Metadata } from "next";
import Link from "next/link";
import { KpiCard } from "@/components/admin/AdminBadges";
import { getAdminOverview } from "@/lib/admin/overview";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { listAdminUsers } from "@/lib/admin/users";
import { gradeLabel } from "@/lib/scores/grade";
import type { HealthGrade } from "@/audit/types";

export const metadata: Metadata = {
  title: "Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCommandCenterPage() {
  const { userId } = await requireAdminPage("viewer");
  const [overview, atRiskUsers] = await Promise.all([
    getAdminOverview(),
    listAdminUsers({ status: "at_risk", pageSize: 5 }),
  ]);

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "command_center",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Command Center</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Platform overview</h1>
        <p className="mt-2 text-[#94a3b8]">
          Monitor user health, task execution, and nightly ingest status.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total users" value={overview.totalUsers} hint={`${overview.signups30d} joined in 30d`} />
        <KpiCard
          label="Active businesses"
          value={overview.activeBusinesses}
          hint="Onboarded with GBP connected"
        />
        <KpiCard
          label="Avg Reputation Boost Score"
          value={overview.avgScore ?? "—"}
          hint={overview.avgScore !== null ? "Across users with scores" : "No score data yet"}
        />
        <KpiCard
          label="Pending approvals"
          value={overview.pendingTasks}
          hint={`${overview.completedTasks7d} completed in 7d`}
          tone={overview.pendingTasks > 20 ? "warning" : "default"}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Score movers (7d)"
          value={`↑${overview.scoreMoversUp} / ↓${overview.scoreMoversDown}`}
          hint="Users with ±5 pt change"
        />
        <KpiCard
          label="Stale accounts"
          value={overview.staleAccounts}
          hint="No audit in 14+ days"
          tone={overview.staleAccounts > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Healthy users"
          value={overview.gradeDistribution.healthy}
          tone="success"
        />
        <KpiCard
          label="Urgent users"
          value={overview.gradeDistribution.urgent}
          tone={overview.gradeDistribution.urgent > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Grade distribution</h2>
          <div className="mt-4 space-y-3">
            {(["healthy", "at_risk", "urgent"] as HealthGrade[]).map((grade) => {
              const count = overview.gradeDistribution[grade];
              const pct =
                overview.totalUsers > 0 ? Math.round((count / overview.totalUsers) * 100) : 0;
              return (
                <div key={grade}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-[#cbd5e1]">{gradeLabel(grade)}</span>
                    <span className="text-[#94a3b8]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#1e2433]">
                    <div
                      className={`h-full rounded-full ${
                        grade === "healthy"
                          ? "bg-emerald-500"
                          : grade === "at_risk"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Nightly ingest</h2>
          {overview.lastIngest ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#94a3b8]">Status</dt>
                <dd className="font-medium text-white">{overview.lastIngest.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#94a3b8]">Completed</dt>
                <dd className="text-white">
                  {overview.lastIngest.completedAt
                    ? new Date(overview.lastIngest.completedAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#94a3b8]">Businesses processed</dt>
                <dd className="text-white">{overview.lastIngest.businessesProcessed}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#94a3b8]">Errors</dt>
                <dd className={overview.lastIngest.errorCount > 0 ? "text-red-400" : "text-emerald-400"}>
                  {overview.lastIngest.errorCount}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[#64748b]">No ingest runs recorded yet.</p>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-[#2d3348] bg-[#151923] p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Users needing attention</h2>
          <Link href="/admin/users?status=at_risk" className="text-sm text-[#818cf8] hover:text-[#a5b4fc]">
            View all →
          </Link>
        </div>
        {atRiskUsers.users.length === 0 ? (
          <p className="text-sm text-[#64748b]">No at-risk users right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#2d3348]">
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 pr-4 font-medium">Score</th>
                  <th className="pb-3 pr-4 font-medium">Pending tasks</th>
                  <th className="pb-3 font-medium">Last audit</th>
                </tr>
              </thead>
              <tbody>
                {atRiskUsers.users.map((user) => (
                  <tr key={user.userId} className="border-b border-[#2d3348]/60">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/users/${user.userId}`} className="font-medium text-white hover:text-[#a5b4fc]">
                        {user.fullName || user.email || user.userId}
                      </Link>
                      {user.fullName && user.email ? (
                        <p className="text-xs text-[#64748b]">{user.email}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-white">{user.avgScore ?? "—"}</td>
                    <td className="py-3 pr-4 text-[#cbd5e1]">{user.pendingTasks}</td>
                    <td className="py-3 text-[#94a3b8]">
                      {user.lastAuditAt ? new Date(user.lastAuditAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
