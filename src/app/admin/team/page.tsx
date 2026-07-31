import type { Metadata } from "next";
import TeamManagementPanel from "@/components/admin/TeamManagementPanel";
import { logAdminAction, requireGodModePage } from "@/lib/admin/auth";
import { listAdminTeamMembers } from "@/lib/admin/team";

export const metadata: Metadata = {
  title: "Team | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const { userId } = await requireGodModePage();
  const members = await listAdminTeamMembers();

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "team",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-violet-400">God mode</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Admin team</h1>
        <p className="mt-2 max-w-2xl text-[#94a3b8]">
          Grant or revoke admin access for operators and viewers. God-mode accounts are controlled by{" "}
          <code className="rounded bg-[#1e2433] px-1.5 py-0.5 text-xs text-violet-300">
            ADMIN_BOOTSTRAP_EMAILS
          </code>{" "}
          and cannot be removed here.
        </p>
      </div>

      <TeamManagementPanel members={members} />
    </div>
  );
}
