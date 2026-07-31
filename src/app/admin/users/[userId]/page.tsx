import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DeltaBadge,
  formatRelativeDate,
  GradeBadge,
  KpiCard,
  StatusBadge,
} from "@/components/admin/AdminBadges";
import AdminNotesPanel from "@/components/admin/AdminNotesPanel";
import ViewAsUserButton from "@/components/admin/ViewAsUserButton";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { listAdminNotes } from "@/lib/admin/notes";
import { getAdminUserDetail } from "@/lib/admin/users";

export const metadata: Metadata = {
  title: "User detail | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId: adminUserId, role } = await requireAdminPage("viewer");
  const { userId } = await params;
  const [user, notes] = await Promise.all([getAdminUserDetail(userId), listAdminNotes(userId)]);

  if (!user) {
    notFound();
  }

  const canWrite = role === "operator" || role === "superadmin";
  const canImpersonate = canWrite;

  await logAdminAction({
    adminUserId,
    action: "view_page",
    targetType: "user",
    targetId: userId,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/admin/users" className="text-sm text-[#94a3b8] transition-colors hover:text-white">
        ← Back to users
      </Link>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">User detail</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{user.fullName || "Unnamed user"}</h1>
          <p className="mt-1 text-[#94a3b8]">{user.email}</p>
          <p className="mt-1 font-mono text-xs text-[#64748b]">{user.userId}</p>
        </div>
        <StatusBadge status={user.status} />
      </div>

      {canImpersonate ? (
        <div className="mt-4">
          <ViewAsUserButton userId={user.userId} />
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Reputation Boost Score" value={user.avgScore ?? "—"} />
        <KpiCard label="Score change (7d)" value={user.scoreDelta7d ?? "—"} />
        <KpiCard
          label="Pending tasks"
          value={user.pendingTasks}
          tone={user.pendingTasks > 0 ? "warning" : "default"}
        />
        <KpiCard label="Completed tasks" value={user.completedTasks} tone="success" />
      </div>

      <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="Businesses" value={`${user.onboardedCount} onboarded / ${user.businessCount} total`} />
        <InfoItem label="GBP connected" value={String(user.gbpConnectedCount)} />
        <InfoItem label="Grade" value={<GradeBadge grade={user.grade} />} />
        <InfoItem label="Autopilot mode" value={user.dominantAutopilotMode ?? "—"} />
        <InfoItem label="Last audit" value={formatRelativeDate(user.lastAuditAt)} />
        <InfoItem label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
        <InfoItem label="Failed tasks" value={String(user.failedTasks)} />
        <InfoItem label="7d score delta" value={<DeltaBadge delta={user.scoreDelta7d} />} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Businesses</h2>
        {user.businesses.length === 0 ? (
          <p className="mt-3 text-sm text-[#64748b]">No businesses yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {user.businesses.map((business) => (
              <article
                key={business.id}
                className="rounded-xl border border-[#2d3348] bg-[#151923] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/businesses/${business.id}`}
                      className="font-semibold text-white hover:text-[#a5b4fc]"
                    >
                      {business.name}
                    </Link>
                    <p className="text-sm text-[#94a3b8]">
                      {business.industry}
                      {business.location ? ` · ${business.location}` : ""}
                    </p>
                  </div>
                  <GradeBadge grade={business.grade} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[#64748b]">Score</dt>
                    <dd className="font-medium text-white">{business.score ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#64748b]">Autopilot</dt>
                    <dd className="text-[#cbd5e1]">{business.autopilotMode}</dd>
                  </div>
                  <div>
                    <dt className="text-[#64748b]">Onboarding</dt>
                    <dd className={business.onboardingComplete ? "text-emerald-400" : "text-amber-400"}>
                      {business.onboardingComplete ? "Complete" : "Incomplete"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748b]">GBP</dt>
                    <dd className={business.gbpConnected ? "text-emerald-400" : "text-red-400"}>
                      {business.gbpConnected ? "Connected" : "Disconnected"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748b]">Tasks</dt>
                    <dd className="text-[#cbd5e1]">
                      {business.pendingTasks} pending · {business.completedTasks} done
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748b]">Last audit</dt>
                    <dd className="text-[#94a3b8]">{formatRelativeDate(business.lastAuditAt)}</dd>
                  </div>
                </dl>
                {canImpersonate ? (
                  <div className="mt-4">
                    <ViewAsUserButton
                      userId={user.userId}
                      businessId={business.id}
                      label="View this location"
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Recent tasks</h2>
        {user.recentTasks.length === 0 ? (
          <p className="mt-3 text-sm text-[#64748b]">No tasks yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#2d3348] bg-[#151923]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#1a1f2e] text-[#64748b]">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {user.recentTasks.map((task) => (
                  <tr key={task.id} className="border-t border-[#2d3348]/60">
                    <td className="px-4 py-3 text-white">{task.title}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{task.businessName}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{task.taskType}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{task.priority}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{task.status}</td>
                    <td className="px-4 py-3 text-[#64748b]">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-10">
        <AdminNotesPanel userId={user.userId} notes={notes} canWrite={canWrite} />
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2d3348] bg-[#151923] px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-[#64748b]">{label}</dt>
      <dd className="mt-1 text-[#e2e8f0]">{value}</dd>
    </div>
  );
}
