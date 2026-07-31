import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import {
  getActiveBusiness,
  listBusinessSummaries,
  withBusinessId,
} from "@/lib/business/active-business";
import { getPlatformViewerContext } from "@/lib/admin/platform-context";

export const metadata: Metadata = {
  title: "Locations | Reputation Boost",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function LocationsPage({ searchParams }: PageProps) {
  const ctx = await getPlatformViewerContext();
  if (!ctx) redirect("/login?next=/platform/locations");

  const params = await searchParams;
  const businesses = await listBusinessSummaries(ctx.viewerUserId);
  const activeBusiness = await getActiveBusiness(
    ctx.viewerUserId,
    params.businessId ?? ctx.impersonationBusinessId ?? undefined
  );
  const activeBusinessId = activeBusiness?.businessId ?? businesses[0]?.id;

  if (businesses.length === 0) {
    redirect("/platform/onboard");
  }

  const locations = await Promise.all(
    businesses.map(async (business) => {
      const latestAudit = await loadLatestAuditFromSupabase(ctx.viewerUserId, business.slug);
      return {
        ...business,
        score: latestAudit?.strategy?.scores.overall ?? null,
        lastAuditAt: latestAudit?.completedAt ?? null,
      };
    })
  );

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#f8f9fa] py-8 lg:py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-[#1a73e8]">
              Portfolio
            </span>
            <h1 className="mt-2 text-3xl font-bold text-[#202124] sm:text-4xl">Your locations</h1>
            <p className="mt-3 max-w-2xl text-[#5f6368]">
              Manage every location under your account. Switch between them or add another to your
              portfolio.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/platform/onboard?add=1"
              className="btn-primary inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            >
              + Add location
            </Link>
            {businesses.some((business) => business.googleEmail) && (
              <Link
                href="/platform/onboard?add=1&import=1"
                className="inline-flex rounded-full border border-[#1a73e8] bg-[#e8f0fe] px-5 py-2.5 text-sm font-semibold text-[#1a73e8] transition hover:bg-[#d2e3fc]"
              >
                Import from Google
              </Link>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#dadce0] bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-[#e8eaed] bg-[#f8f9fa] px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#80868b] max-lg:hidden">
            <span>Location</span>
            <span className="w-40">Google account</span>
            <span className="w-20 text-right">Score</span>
            <span className="w-24 text-right">Status</span>
            <span className="w-24 text-right">Action</span>
          </div>

          <div className="divide-y divide-[#e8eaed]">
            {locations.map((location) => {
              const isActive = location.id === activeBusinessId;
              const dashboardHref = withBusinessId("/platform/audit", location.id);
              const settingsHref = withBusinessId("/platform/settings", location.id);

              return (
                <div
                  key={location.id}
                  className={`grid gap-4 px-6 py-4 max-lg:space-y-3 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-center ${
                    isActive ? "bg-[#e8f0fe]/40" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-[#202124]">{location.name}</p>
                      {isActive && (
                        <span className="rounded-full bg-[#1a73e8] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-[#5f6368]">
                      {[location.city, location.state].filter(Boolean).join(", ")}
                    </p>
                    {location.googleEmail && (
                      <p className="mt-1 truncate text-xs text-[#80868b] lg:hidden">
                        Google: {location.googleEmail}
                      </p>
                    )}
                  </div>

                  <div className="hidden w-40 min-w-0 lg:block">
                    <p className="truncate text-sm text-[#5f6368]">
                      {location.googleEmail ?? "Not connected"}
                    </p>
                  </div>

                  <div className="lg:w-20 lg:text-right">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#80868b] sm:hidden">
                      Score
                    </span>
                    <p className="text-sm font-semibold text-[#202124]">
                      {location.score != null ? location.score : "—"}
                    </p>
                  </div>

                  <div className="lg:w-24 lg:text-right">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#80868b] sm:hidden">
                      Status
                    </span>
                    {location.onboardingComplete && location.gbpConnected ? (
                      <span className="inline-flex rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#137333]">
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-[#fef7e0] px-2.5 py-1 text-xs font-semibold text-[#b06000]">
                        Setup
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:w-24 lg:justify-end">
                    {location.onboardingComplete ? (
                      <Link
                        href={dashboardHref}
                        className="rounded-full border border-[#dadce0] px-3 py-1.5 text-xs font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
                      >
                        {isActive ? "Dashboard" : "Switch"}
                      </Link>
                    ) : (
                      <Link
                        href={`/platform/onboard?businessId=${location.id}`}
                        className="rounded-full border border-[#1a73e8] bg-[#e8f0fe] px-3 py-1.5 text-xs font-semibold text-[#1a73e8] transition hover:bg-[#d2e3fc]"
                      >
                        Finish setup
                      </Link>
                    )}
                    <Link
                      href={settingsHref}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#5f6368] transition hover:bg-[#f8f9fa] hover:text-[#202124]"
                    >
                      Settings
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
