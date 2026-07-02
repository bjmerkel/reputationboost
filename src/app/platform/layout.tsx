import { getUser } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/platform/audit" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <span className="font-bold text-white">Reputation Boost</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Platform
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/platform/audit" className="hidden text-sm text-slate-400 hover:text-white sm:inline">
              Dashboard
            </Link>
            <Link href="/platform/onboard" className="hidden text-sm text-slate-400 hover:text-white sm:inline">
              Settings
            </Link>
            {user && (
              <span className="hidden text-sm text-slate-400 md:inline">{user.email}</span>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="btn-secondary rounded-full px-4 py-2 text-sm font-medium text-white"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
