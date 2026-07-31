import type { Metadata } from "next";
import Link from "next/link";
import { DeltaBadge, GradeBadge, KpiCard } from "@/components/admin/AdminBadges";
import PlatformScoreChart from "@/components/admin/PlatformScoreChart";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { getAdminScoresData } from "@/lib/admin/scores";
import { gradeLabel } from "@/lib/scores/grade";
import type { HealthGrade } from "@/audit/types";

export const metadata: Metadata = {
  title: "Scores | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminScoresPage() {
  const { userId } = await requireAdminPage("viewer");
  const data = await getAdminScoresData();

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "scores",
  });

  const components = [
    { label: "Visibility", value: data.componentAverages.visibility },
    { label: "Conversion", value: data.componentAverages.conversion },
    { label: "Revenue capture", value: data.componentAverages.revenueCapture },
    { label: "Driver score", value: data.componentAverages.driverScore },
    { label: "Outcome index", value: data.componentAverages.outcomeIndex },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Scores</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Platform score analytics</h1>
        <p className="mt-2 text-[#94a3b8]">
          Reputation Boost Score trends, component breakdown, and movers across all businesses.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Scored businesses" value={data.businessCount} />
        <KpiCard label="Platform avg" value={data.avgOverall ?? "—"} />
        <KpiCard label="Median score" value={data.medianOverall ?? "—"} />
        <KpiCard
          label="Urgent grade"
          value={data.gradeDistribution.urgent}
          hint={`${data.gradeDistribution.healthy} healthy`}
          tone={data.gradeDistribution.urgent > 0 ? "warning" : "default"}
        />
      </div>

      <section className="mt-8 rounded-xl border border-[#2d3348] bg-[#151923] p-6">
        <h2 className="text-lg font-semibold text-white">90-day platform trend</h2>
        <p className="mt-1 text-sm text-[#64748b]">Average Reputation Boost Score across all businesses</p>
        <div className="mt-4">
          <PlatformScoreChart points={data.platformTrend} />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Grade distribution</h2>
          <div className="mt-4 space-y-3">
            {(["healthy", "at_risk", "urgent"] as HealthGrade[]).map((grade) => {
              const count = data.gradeDistribution[grade];
              const pct =
                data.businessCount > 0 ? Math.round((count / data.businessCount) * 100) : 0;
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
          <h2 className="text-lg font-semibold text-white">Component averages</h2>
          <div className="mt-4 space-y-3">
            {components.map((component) => (
              <div key={component.label} className="flex items-center justify-between text-sm">
                <span className="text-[#cbd5e1]">{component.label}</span>
                <span className="font-medium text-white">{component.value ?? "—"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Top movers (7d)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#2d3348]">
                  <th className="pb-3 pr-4 font-medium">Business</th>
                  <th className="pb-3 pr-4 font-medium">Score</th>
                  <th className="pb-3 font-medium">Δ 7d</th>
                </tr>
              </thead>
              <tbody>
                {data.topMoversUp.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-[#64748b]">
                      No significant gains this week.
                    </td>
                  </tr>
                ) : (
                  data.topMoversUp.map((row) => (
                    <tr key={row.businessId} className="border-b border-[#2d3348]/60">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/businesses/${row.businessId}`}
                          className="text-white hover:text-[#a5b4fc]"
                        >
                          {row.businessName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[#cbd5e1]">{row.currentScore}</td>
                      <td className="py-3">
                        <DeltaBadge delta={row.delta7d} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Biggest drops (7d)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#2d3348]">
                  <th className="pb-3 pr-4 font-medium">Business</th>
                  <th className="pb-3 pr-4 font-medium">Score</th>
                  <th className="pb-3 font-medium">Δ 7d</th>
                </tr>
              </thead>
              <tbody>
                {data.topMoversDown.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-[#64748b]">
                      No significant drops this week.
                    </td>
                  </tr>
                ) : (
                  data.topMoversDown.map((row) => (
                    <tr key={row.businessId} className="border-b border-[#2d3348]/60">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/businesses/${row.businessId}`}
                          className="text-white hover:text-[#a5b4fc]"
                        >
                          {row.businessName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-[#cbd5e1]">{row.currentScore}</td>
                      <td className="py-3">
                        <DeltaBadge delta={row.delta7d} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {data.industryBreakdown.length > 0 ? (
        <section className="mt-8 rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">By industry</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#2d3348]">
                  <th className="pb-3 pr-4 font-medium">Industry</th>
                  <th className="pb-3 pr-4 font-medium">Businesses</th>
                  <th className="pb-3 pr-4 font-medium">Avg score</th>
                  <th className="pb-3 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.industryBreakdown.map((row) => (
                  <tr key={row.industry} className="border-b border-[#2d3348]/60">
                    <td className="py-3 pr-4 text-white">{row.industry}</td>
                    <td className="py-3 pr-4 text-[#cbd5e1]">{row.businessCount}</td>
                    <td className="py-3 pr-4 text-[#cbd5e1]">{row.avgScore}</td>
                    <td className="py-3">
                      <GradeBadge grade={row.grade} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
