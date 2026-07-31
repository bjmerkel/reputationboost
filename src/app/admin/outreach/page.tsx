import type { Metadata } from "next";
import Link from "next/link";
import { formatRelativeDate } from "@/components/admin/AdminBadges";
import { ChurnRiskBadge, HealthIndexBadge } from "@/components/admin/IntelligenceBadges";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { getAdminOutreachData } from "@/lib/admin/outreach";
import type { OutreachPriority } from "@/lib/admin/outreach";

export const metadata: Metadata = {
  title: "Outreach | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function priorityClass(priority: OutreachPriority): string {
  if (priority === "critical") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (priority === "high") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-slate-500/15 text-slate-300 border-slate-500/30";
}

function priorityLabel(priority: OutreachPriority): string {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High";
  return "Medium";
}

export default async function AdminOutreachPage() {
  const { userId } = await requireAdminPage("viewer");
  const data = await getAdminOutreachData();

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "outreach",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Outreach</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Intervention queue</h1>
        <p className="mt-2 text-[#94a3b8]">
          Prioritized list of users who need proactive outreach, sorted by churn risk.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#2d3348] bg-[#151923] p-5">
          <p className="text-sm text-[#94a3b8]">In queue</p>
          <p className="mt-2 text-3xl font-bold text-white">{data.total}</p>
        </div>
        <div className="rounded-xl border border-[#2d3348] bg-[#151923] p-5">
          <p className="text-sm text-[#94a3b8]">Critical</p>
          <p className="mt-2 text-3xl font-bold text-red-400">{data.criticalCount}</p>
        </div>
        <div className="rounded-xl border border-[#2d3348] bg-[#151923] p-5">
          <p className="text-sm text-[#94a3b8]">High priority</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{data.highCount}</p>
        </div>
        <div className="rounded-xl border border-[#2d3348] bg-[#151923] p-5">
          <p className="text-sm text-[#94a3b8]">Never contacted</p>
          <p className="mt-2 text-3xl font-bold text-white">{data.neverContacted}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2d3348] bg-[#151923]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#1a1f2e] text-[#64748b]">
              <tr>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Churn</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Last contact</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.queue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#64748b]">
                    No users need outreach right now.
                  </td>
                </tr>
              ) : (
                data.queue.map((item) => (
                  <tr key={item.user.userId} className="border-t border-[#2d3348]/60 hover:bg-[#1a1f2e]/60">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${priorityClass(item.priority)}`}
                      >
                        {priorityLabel(item.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${item.user.userId}`}
                        className="font-medium text-white hover:text-[#a5b4fc]"
                      >
                        {item.user.fullName || item.user.email || item.user.userId}
                      </Link>
                      {item.user.businesses[0] ? (
                        <p className="text-xs text-[#818cf8]">{item.user.businesses[0].name}</p>
                      ) : null}
                      {item.segments.length > 0 ? (
                        <p className="mt-1 text-xs text-[#64748b]">{item.segments.join(" · ")}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <HealthIndexBadge index={item.user.healthIndex} />
                    </td>
                    <td className="px-4 py-3">
                      <ChurnRiskBadge risk={item.user.churnRisk} level={item.user.churnRiskLevel} />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-[#94a3b8]">{item.reason}</td>
                    <td className="px-4 py-3 text-[#64748b]">
                      {item.lastNoteAt ? formatRelativeDate(item.lastNoteAt) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${item.user.userId}`}
                        className="text-[#818cf8] hover:text-[#a5b4fc]"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
