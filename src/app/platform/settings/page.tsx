import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBusinessRecord } from "@/audit/businesses";
import GbpPerformanceSetup from "@/components/GbpPerformanceSetup";
import GbpDisconnect from "@/components/GbpDisconnect";
import GbpLocationSwitcher from "@/components/GbpLocationSwitcher";
import GoogleMapsLink from "@/components/GoogleMapsLink";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import RoiSettings from "@/components/RoiSettings";
import { getActiveBusiness, listBusinessSummaries } from "@/lib/business/active-business";
import { getPlatformViewerContext } from "@/lib/admin/platform-context";

export const metadata: Metadata = {
  title: "Settings | Reputation Boost",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const ctx = await getPlatformViewerContext();
  if (!ctx) redirect("/login?next=/platform/settings");

  const params = await searchParams;
  const business = await getActiveBusiness(
    ctx.viewerUserId,
    params.businessId ?? ctx.impersonationBusinessId ?? undefined
  );
  if (!business) {
    redirect("/platform/onboard");
  }

  const allBusinesses = await listBusinessSummaries(ctx.viewerUserId);

  const record = business.businessId
    ? await getBusinessRecord(ctx.viewerUserId, business.businessId)
    : null;

  const isConnected = Boolean(
    business.gbpConnection && business.onboardingComplete && record?.gbp_location_id
  );

  const mapsUrl = record?.gbp_maps_url ?? business.gbpMapsUrl ?? null;
  const auditHref = business.businessId
    ? `/platform/audit?businessId=${business.businessId}`
    : "/platform/audit";

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#f8f9fa] py-8 lg:py-10">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <Link
          href={auditHref}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#5f6368] transition-colors hover:text-[#202124]"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-8">
          <span className="text-sm font-semibold uppercase tracking-widest text-[#1a73e8]">
            Settings
          </span>
          <h1 className="mt-2 text-3xl font-bold text-[#202124] sm:text-4xl">
            Account &amp; connections
          </h1>
          <p className="mt-3 text-[#5f6368]">
            Manage your Google Business Profile connection and platform access.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#202124]">Active location</h2>
                {allBusinesses.length > 1 && (
                  <p className="mt-1 text-sm text-[#5f6368]">
                    {allBusinesses.length} locations in your portfolio
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allBusinesses.length > 1 && (
                  <Link
                    href={
                      business.businessId
                        ? `/platform/locations?businessId=${business.businessId}`
                        : "/platform/locations"
                    }
                    className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
                  >
                    All locations
                  </Link>
                )}
                <Link
                  href="/platform/onboard?add=1"
                  className="rounded-full border border-[#1a73e8] bg-[#e8f0fe] px-4 py-2 text-sm font-semibold text-[#1a73e8] transition hover:bg-[#d2e3fc]"
                >
                  Add location
                </Link>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#80868b]">Name</dt>
                <dd className="text-[#3c4043]">{business.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#80868b]">Industry</dt>
                <dd className="text-[#3c4043]">{business.industry}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#80868b]">Location</dt>
                <dd className="text-right text-[#3c4043]">
                  {business.location.city}, {business.location.state}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#80868b]">Keywords</dt>
                <dd className="text-right text-[#3c4043]">{business.keywords.length} tracked</dd>
              </div>
            </dl>
            <div className="mt-4">
              <GoogleMapsLink
                mapsUrl={mapsUrl}
                name={business.name}
                address={
                  business.gbpAddress ??
                  `${business.location.address}, ${business.location.city}, ${business.location.state} ${business.location.zip}`
                }
              />
            </div>
          </div>

          <ChangePasswordForm />

          <RoiSettings
            businessId={business.businessId ?? record?.id ?? ""}
            initialValue={record?.avg_customer_value != null ? Number(record.avg_customer_value) : null}
            currency={record?.avg_customer_value_currency ?? "USD"}
            industry={business.industry}
          />

          {isConnected && business.businessId ? (
            <>
              <GbpLocationSwitcher
                businessId={business.businessId}
                currentLocationId={record?.gbp_location_id ?? business.gbpConnection?.locationId}
              />
              <GbpPerformanceSetup
                businessId={business.businessId}
                reconnectHref={`/api/google/gbp/connect?businessId=${business.businessId}`}
                platformEmail={ctx.viewerEmail ?? undefined}
                storedGoogleEmail={record?.gbp_google_email ?? business.gbpConnection?.googleEmail}
                variant="light"
              />
              <GbpDisconnect
                businessId={business.businessId}
                businessName={business.name}
                connectedAt={record?.gbp_connected_at ?? null}
                googleEmail={record?.gbp_google_email ?? business.gbpConnection?.googleEmail}
                variant="light"
              />
            </>
          ) : (
            <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#202124]">Google Business Profile</h2>
              <p className="mt-2 text-sm text-[#5f6368]">Not connected for this location.</p>
              <Link
                href={`/platform/onboard?businessId=${business.businessId}`}
                className="btn-primary mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                Connect Google Business Profile
              </Link>
            </div>
          )}

          <p className="text-center text-sm text-[#80868b]">
            App login: <span className="text-[#3c4043]">{ctx.viewerEmail}</span>
            {(record?.gbp_google_email ?? business.gbpConnection?.googleEmail) && (
              <>
                {" "}
                · Profile manager:{" "}
                <span className="text-[#3c4043]">
                  {record?.gbp_google_email ?? business.gbpConnection?.googleEmail}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
