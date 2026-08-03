import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ScoreTrendChart from "@/components/attribution/ScoreTrendChart";
import {
  DeltaBadge,
  formatRelativeDate,
  GradeBadge,
  KpiCard,
} from "@/components/admin/AdminBadges";
import ViewAsUserButton from "@/components/admin/ViewAsUserButton";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { getAdminBusinessDetail } from "@/lib/admin/businesses";

export const metadata: Metadata = {
  title: "Business | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function AdminBusinessDetailPage({ params }: PageProps) {
  const { userId: adminUserId, role } = await requireAdminPage("viewer");
  const { businessId } = await params;
  const business = await getAdminBusinessDetail(businessId);

  if (!business) {
    notFound();
  }

  await logAdminAction({
    adminUserId,
    action: "view_page",
    targetType: "business",
    targetId: businessId,
  });

  const canImpersonate = role === "operator" || role === "superadmin";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href={`/admin/users/${business.userId}`} className="text-sm text-[#94a3b8] hover:text-white">
        ← Back to user
      </Link>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Business 360°</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{business.name}</h1>
          <p className="mt-1 text-[#94a3b8]">
            {business.industry}
            {business.location ? ` · ${business.location}` : ""}
          </p>
          <p className="mt-2 text-sm text-[#64748b]">
            Owner:{" "}
            <Link href={`/admin/users/${business.userId}`} className="text-[#a5b4fc] hover:underline">
              {business.userName || business.userEmail}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <GradeBadge grade={business.grade} />
          {canImpersonate ? (
            <ViewAsUserButton
              userId={business.userId}
              businessId={business.id}
              label="Manage as user"
            />
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Reputation Boost Score" value={business.score ?? "—"} />
        <KpiCard label="Pending tasks" value={business.pendingTasks} tone={business.pendingTasks > 0 ? "warning" : "default"} />
        <KpiCard label="Completed tasks" value={business.completedTasks} tone="success" />
        <KpiCard label="Failed tasks" value={business.failedTasks} tone={business.failedTasks > 0 ? "danger" : "default"} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Connection & settings</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <InfoRow label="Onboarding" value={business.onboardingComplete ? "Complete" : "Incomplete"} />
            <InfoRow label="GBP" value={business.gbpConnected ? "Connected" : "Disconnected"} />
            <InfoRow label="Autopilot" value={business.autopilotMode} />
            <InfoRow label="Website" value={business.website ?? "—"} />
            <InfoRow label="Phone" value={business.phone ?? "—"} />
            <InfoRow label="Last updated" value={formatRelativeDate(business.lastAuditAt)} />
            <InfoRow label="Score date" value={business.scoreDate ?? "—"} />
          </dl>
        </section>

        <section className="rounded-xl border border-[#2d3348] bg-[#151923] p-6">
          <h2 className="text-lg font-semibold text-white">Latest audit snapshot</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <InfoRow label="Audit score" value={business.auditScore ?? "—"} />
            <InfoRow label="Audit grade" value={business.auditGrade ?? "—"} />
            <InfoRow label="Visibility" value={business.visibility ?? "—"} />
            <InfoRow label="Conversion" value={business.conversion ?? "—"} />
            <InfoRow label="Revenue capture" value={business.revenueCapture ?? "—"} />
            <InfoRow
              label="Keywords in pack"
              value={
                business.keywordsInPack != null && business.totalKeywords != null
                  ? `${business.keywordsInPack}/${business.totalKeywords}`
                  : "—"
              }
            />
          </dl>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-[#2d3348] bg-[#151923] p-6">
        <h2 className="text-lg font-semibold text-white">Score trend (90d)</h2>
        <div className="platform-theme mt-4 rounded-lg border border-[#dadce0] bg-white p-4">
          <ScoreTrendChart clientId={business.slug} series={business.scoreSeries} loading={false} />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-[#2d3348] bg-[#151923] p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Recent tasks</h2>
          <Link
            href={`/admin/tasks?businessId=${business.id}`}
            className="text-sm text-[#818cf8] hover:text-[#a5b4fc]"
          >
            View all →
          </Link>
        </div>
        {business.recentTasks.length === 0 ? (
          <p className="text-sm text-[#64748b]">No tasks yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[#64748b]">
                <tr className="border-b border-[#2d3348]">
                  <th className="pb-3 pr-4 font-medium">Task</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Priority</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {business.recentTasks.map((task) => (
                  <tr key={task.id} className="border-b border-[#2d3348]/60">
                    <td className="py-3 pr-4 text-white">{task.title}</td>
                    <td className="py-3 pr-4 text-[#94a3b8]">{task.taskType}</td>
                    <td className="py-3 pr-4 text-[#cbd5e1]">{task.priority}</td>
                    <td className="py-3 text-[#cbd5e1]">{task.status}</td>
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

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#64748b]">{label}</dt>
      <dd className="text-right text-[#e2e8f0]">{value}</dd>
    </div>
  );
}
