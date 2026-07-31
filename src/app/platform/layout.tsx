import { Suspense } from "react";
import {
  listBusinessSummaries,
  resolveActiveBusinessId,
} from "@/lib/business/active-business";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import BusinessSwitcher from "@/components/BusinessSwitcher";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import { getPlatformViewerContext } from "@/lib/admin/platform-context";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getPlatformViewerContext();
  const businesses = ctx ? await listBusinessSummaries(ctx.viewerUserId) : [];
  const activeBusinessId = ctx
    ? await resolveActiveBusinessId(
        ctx.viewerUserId,
        ctx.impersonationBusinessId ?? undefined
      )
    : null;
  const showSwitcher = Boolean(ctx && businesses.length > 0 && activeBusinessId);

  function platformHref(path: string): string {
    if (!activeBusinessId) return path;
    return `${path}?businessId=${activeBusinessId}`;
  }

  const viewerLabel =
    ctx?.viewerName || ctx?.viewerEmail || (ctx?.isImpersonating ? "User" : null);

  return (
    <div className="platform-theme flex h-dvh flex-col overflow-hidden">
      {ctx?.isImpersonating && viewerLabel ? (
        <ImpersonationBanner viewerLabel={viewerLabel} adminEmail={ctx.sessionEmail} />
      ) : null}
      <header className="shrink-0 border-b border-[#dadce0] bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={platformHref("/platform/audit")} className="flex shrink-0 items-center">
              <AppLogo className="h-9 w-auto" />
            </Link>
            {showSwitcher && (
              <Suspense fallback={null}>
                <BusinessSwitcher
                  businesses={businesses}
                  activeBusinessId={activeBusinessId!}
                />
              </Suspense>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <Link
              href={platformHref("/platform/audit")}
              className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
            >
              Dashboard
            </Link>
            {businesses.length > 1 && (
              <Link
                href={platformHref("/platform/locations")}
                className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
              >
                Locations
              </Link>
            )}
            <Link
              href={platformHref("/platform/customers")}
              className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
            >
              Customers
            </Link>
            <Link
              href={platformHref("/platform/settings")}
              className="hidden text-sm text-[#5f6368] hover:text-[#202124] sm:inline"
            >
              Settings
            </Link>
            {ctx && (
              <span className="hidden text-sm text-[#80868b] md:inline">
                {ctx.isImpersonating ? ctx.viewerEmail : ctx.sessionEmail}
              </span>
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
