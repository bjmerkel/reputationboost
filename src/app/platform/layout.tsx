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
    <div className="platform-theme flex h-dvh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[#dadce0] bg-white">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/platform/audit" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a73e8]">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <span className="font-semibold text-[#202124]">Reputation Boost</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/platform/audit"
              className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
            >
              Dashboard
            </Link>
            <Link
              href="/platform/settings"
              className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
            >
              Settings
            </Link>
            {user && (
              <span className="hidden text-sm text-[#80868b] md:inline">{user.email}</span>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="btn-secondary rounded-full px-4 py-2 text-sm font-medium"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
