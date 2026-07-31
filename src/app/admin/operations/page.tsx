import type { Metadata } from "next";
import Link from "next/link";
import { formatRelativeDate, KpiCard } from "@/components/admin/AdminBadges";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { getAdminOperationsData } from "@/lib/admin/operations";

export const metadata: Metadata = {
  title: "Operations | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  if (status === "completed" || status === "success") return "text-emerald-400";
  if (status === "failed") return "text-red-400";
  if (status === "running") return "text-amber-400";
  return "text-[#cbd5e1]";
}

function formatSchedule(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  if (cron === "0 6 * * *") return "Daily 6:00 UTC";
  if (cron === "0 5 * * *") return "Daily 5:00 UTC";
  if (cron === "0 7 1 * *") return "Monthly 1st 7:00 UTC";
  if (cron === "0 3 * * 0") return "Sundays 3:00 UTC";
  if (cron === "0 8 * * 1") return "Mondays 8:00 UTC";
  if (minute.startsWith("*/")) return `Every ${minute.slice(2)} min`;
  if (hour === "*") return `Hourly at :${minute.padStart(2, "0")}`;
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")} UTC`;
}

export default async function AdminOperationsPage() {
  const { userId } = await requireAdminPage("viewer");
  const data = await getAdminOperationsData();
  const { platformHealth } = data;

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "operations",
  });

  const pendingTasks = platformHealth.taskStatusCounts.pending_approval ?? 0;
  const failedTasks = platformHealth.taskStatusCounts.failed ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Operations</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Platform health</h1>
        <p className="mt-2 text-[#94a3b8]">
          Ingest pipeline status, cron schedules, and infrastructure signals.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="GBP disconnected"
          value={platformHealth.gbpDisconnected}
          hint={`${platformHealth.gbpConnected} of ${platformHealth.onboardedBusinesses} connected`}
          tone={platformHealth.gbpDisconnected > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="Pending tasks"
          value={pendingTasks}
          hint={`${failedTasks} failed`}
          tone={pendingTasks > 20 ? "warning" : "default"}
        />
        <KpiCard
          label="Places API usage"
          value={
            platformHealth.placesBudgetUtilization !== null
              ? `${platformHealth.placesBudgetUtilization}%`
              : "—"
          }
          hint={`${platformHealth.placesCallsReserved} / ${platformHealth.placesCallsBudget} calls`}
        />
        <KpiCard
          label="Latest performance data"
          value={platformHealth.latestPerformanceDate ?? "—"}
          hint={`${platformHealth.marketClaimsRunning} market claims running`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Last run per job</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#2d3348]">
                  <th className="pb-3 pr-4 font-medium">Job</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Processed</th>
                  <th className="pb-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {data.lastRunByJob.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-[#64748b]">
                      No ingest runs recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.lastRunByJob.map((run) => (
                    <tr key={run.id} className="border-b border-[#2d3348]/60">
                      <td className="py-3 pr-4 font-medium text-white">{run.jobName}</td>
                      <td className={`py-3 pr-4 font-medium ${statusClass(run.status)}`}>
                        {run.status}
                        {run.errorCount > 0 ? ` (${run.errorCount} err)` : ""}
                      </td>
                      <td className="py-3 pr-4 text-[#cbd5e1]">{run.businessesProcessed}</td>
                      <td className="py-3 text-[#64748b]">{formatRelativeDate(run.startedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Cron schedules</h2>
          <div className="mt-4 space-y-2">
            {data.cronSchedules.map((cron) => (
              <div
                key={cron.jobName}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#2d3348]/60 bg-[#1a1f2e] px-3 py-2 text-sm"
              >
                <span className="font-medium text-white">{cron.jobName}</span>
                <span className="text-[#94a3b8]">{formatSchedule(cron.schedule)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-[#2d3348] bg-[#151923] p-6">
        <h2 className="text-lg font-semibold text-white">Recent ingest runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[#64748b]">
              <tr className="border-b border-[#2d3348]">
                <th className="pb-3 pr-4 font-medium">Job</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Businesses</th>
                <th className="pb-3 pr-4 font-medium">Scores</th>
                <th className="pb-3 pr-4 font-medium">Places</th>
                <th className="pb-3 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRuns.slice(0, 15).map((run) => (
                <tr key={run.id} className="border-b border-[#2d3348]/60">
                  <td className="py-3 pr-4 text-white">{run.jobName}</td>
                  <td className={`py-3 pr-4 font-medium ${statusClass(run.status)}`}>
                    {run.status}
                  </td>
                  <td className="py-3 pr-4 text-[#cbd5e1]">{run.businessesProcessed}</td>
                  <td className="py-3 pr-4 text-[#cbd5e1]">{run.scoreRowsUpserted ?? "—"}</td>
                  <td className="py-3 pr-4 text-[#94a3b8]">
                    {run.placesCallsReserved > 0 ? `${run.placesCallsReserved} calls` : "—"}
                  </td>
                  <td className="py-3 text-[#64748b]">{formatRelativeDate(run.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.recentErrors.length > 0 ? (
        <section className="mt-8 rounded-xl border border-red-500/30 bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Recent ingest errors</h2>
          <div className="mt-4 space-y-3">
            {data.recentErrors.map((error, index) => (
              <div
                key={`${error.runId}-${index}`}
                className="rounded-lg border border-[#2d3348] bg-[#1a1f2e] px-4 py-3 text-sm"
              >
                <p className="font-medium text-red-300">{error.message}</p>
                <p className="mt-1 text-[#64748b]">
                  {error.jobName}
                  {error.step ? ` · ${error.step}` : ""}
                  {error.businessId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/businesses/${error.businessId}`}
                        className="text-[#818cf8] hover:underline"
                      >
                        View business
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
