import type { Metadata } from "next";
import Link from "next/link";
import AlertFeed from "@/components/admin/AlertFeed";
import { KpiCard } from "@/components/admin/AdminBadges";
import SegmentPills from "@/components/admin/SegmentPills";
import { getAdminDashboardData } from "@/lib/admin/overview";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { getAllUserSummaries, listAdminUsers } from "@/lib/admin/users";
import { gradeLabel } from "@/lib/scores/grade";
import type { HealthGrade } from "@/audit/types";

export const metadata: Metadata = {
  title: "Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminCommandCenterPage() {
  const { userId } = await requireAdminPage("viewer");
  const [dashboard, allUsers, attentionUsers] = await Promise.all([
    getAdminDashboardData(),
    getAllUserSummaries(),
    listAdminUsers({ segment: "needs_attention", pageSize: 5 }),
  ]);
  const { overview, alerts } = dashboard;

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
          Monitor user health, churn risk, task execution, and nightly ingest status.
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-[#2d3348] bg-[#151923] p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#64748b]">Smart segments</h2>
        <SegmentPills users={allUsers} />
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total users" value={overview.totalUsers} hint={`${overview.signups30d} joined in 30d`} />
        <KpiCard
          label="Avg health index"
          value={overview.avgHealthIndex ?? "—"}
          hint="Composite user health score"
          tone={overview.avgHealthIndex !== null && overview.avgHealthIndex < 50 ? "warning" : "default"}
        />
        <KpiCard
          label="High churn risk"
          value={overview.highChurnRiskUsers}
          hint="Users likely to disengage"
          tone={overview.highChurnRiskUsers > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Active alerts"
          value={overview.alertCount}
          hint={`${overview.pendingTasks} tasks pending approval`}
          tone={overview.alertCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mb-4 mt-4">
        <Link href="/admin/tasks?status=pending_approval" className="text-sm text-[#818cf8] hover:text-[#a5b4fc]">
          Open task queue →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Avg Reputation Boost Score"
          value={overview.avgScore ?? "—"}
          hint="Across users with scores"
        />
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
          label="Active businesses"
          value={overview.activeBusinesses}
          hint="Onboarded with GBP connected"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Alert feed</h2>
            <Link href="/admin/outreach" className="text-sm text-[#818cf8] hover:text-[#a5b4fc]">
              Outreach queue →
            </Link>
          </div>
          <AlertFeed alerts={alerts} />
        </section>

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

          <div className="mt-8 border-t border-[#2d3348] pt-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-white">Nightly ingest</h3>
              <Link href="/admin/operations" className="text-xs text-[#818cf8] hover:text-[#a5b4fc]">
                View operations →
              </Link>
            </div>
            {overview.lastIngest ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#94a3b8]">Status</dt>
                  <dd className="font-medium text-white">{overview.lastIngest.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#94a3b8]">Errors</dt>
                  <dd className={overview.lastIngest.errorCount > 0 ? "text-red-400" : "text-emerald-400"}>
                    {overview.lastIngest.errorCount}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-[#64748b]">No ingest runs recorded yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-[#2d3348] bg-[#151923] p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Users needing attention</h2>
          <Link href="/admin/users?segment=needs_attention" className="text-sm text-[#818cf8] hover:text-[#a5b4fc]">
            View all →
          </Link>
        </div>
        {attentionUsers.users.length === 0 ? (
          <p className="text-sm text-[#64748b]">No high-priority users right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#2d3348]">
                  <th className="pb-3 pr-4 font-medium">User</th>
                  <th className="pb-3 pr-4 font-medium">Health</th>
                  <th className="pb-3 pr-4 font-medium">Churn risk</th>
                  <th className="pb-3 font-medium">Top signal</th>
                </tr>
              </thead>
              <tbody>
                {attentionUsers.users.map((user) => (
                  <tr key={user.userId} className="border-b border-[#2d3348]/60">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/users/${user.userId}`} className="font-medium text-white hover:text-[#a5b4fc]">
                        {user.fullName || user.email || user.userId}
                      </Link>
                      {user.businesses[0] ? (
                        <p className="text-xs text-[#818cf8]">{user.businesses[0].name}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-white">{user.healthIndex ?? "—"}</td>
                    <td className="py-3 pr-4 text-[#cbd5e1]">{user.churnRisk}%</td>
                    <td className="py-3 text-[#94a3b8]">{user.churnSignals[0] ?? "—"}</td>
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
