import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import AdminNav from "@/components/admin/AdminNav";
import { requireAdminPage } from "@/lib/admin/auth";
import type { AdminRole } from "@/lib/admin/types";

function roleLabel(role: AdminRole, isGodMode: boolean): string {
  if (isGodMode) return "God mode";
  if (role === "superadmin") return "Superadmin";
  if (role === "operator") return "Operator";
  return "Viewer";
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email, role, isGodMode } = await requireAdminPage("viewer");

  return (
    <div className="admin-theme flex min-h-dvh flex-col">
      <header className="shrink-0 border-b border-[#2d3348] bg-[#151923]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/admin" className="flex shrink-0 items-center gap-3">
              <AppLogo className="h-8 w-auto brightness-0 invert" />
              <span className="hidden text-sm font-semibold uppercase tracking-wider text-[#94a3b8] sm:inline">
                Admin
              </span>
            </Link>
            <AdminNav showTeamLink={isGodMode} />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span
              className={`hidden rounded-full border px-2.5 py-1 text-xs font-medium sm:inline ${
                isGodMode
                  ? "border-violet-500/30 bg-violet-500/15 text-violet-300"
                  : "border-[#334155] bg-[#1e2433] text-[#94a3b8]"
              }`}
            >
              {roleLabel(role, isGodMode)}
            </span>
            <span className="hidden text-sm text-[#64748b] md:inline">{email}</span>
            <Link
              href="/platform/audit"
              className="text-sm text-[#94a3b8] transition-colors hover:text-white"
            >
              Platform
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[#334155] px-3 py-1.5 text-sm text-[#cbd5e1] transition-colors hover:border-[#475569] hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
