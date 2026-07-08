import { getUser } from "@/lib/supabase/server";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";

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
          <Link href="/platform/audit" className="flex items-center">
            <AppLogo className="h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/platform/audit"
              className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
            >
              Dashboard
            </Link>
            <Link
              href="/platform/customers"
              className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
            >
              Customers
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
