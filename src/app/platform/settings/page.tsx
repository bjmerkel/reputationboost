import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBusinessRecord, getPrimaryBusiness } from "@/audit/businesses";
import GbpPerformanceSetup from "@/components/GbpPerformanceSetup";
import GbpDisconnect from "@/components/GbpDisconnect";
import GoogleMapsLink from "@/components/GoogleMapsLink";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Settings | Reputation Boost",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/platform/settings");

  const business = await getPrimaryBusiness(user.id);
  if (!business) {
    redirect("/platform/onboard");
  }

  const record = business.businessId
    ? await getBusinessRecord(user.id, business.businessId)
    : null;

  const isConnected = Boolean(
    business.gbpConnection && business.onboardingComplete && record?.gbp_location_id
  );

  return (
    <main className="relative overflow-hidden py-10">
      <div className="mesh-bg absolute inset-0" />
      <div className="relative mx-auto max-w-2xl px-6">
        <div className="mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Settings
          </span>
          <h1 className="mt-2 text-4xl font-extrabold text-white">Account &amp; connections</h1>
          <p className="mt-3 text-slate-400">
            Manage your Google Business Profile connection and platform access.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h2 className="text-lg font-bold text-white">Business</h2>
              <Link
                href="/platform/onboard?change=1"
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Change business
              </Link>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Name</dt>
                <dd className="text-slate-200">{business.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Industry</dt>
                <dd className="text-slate-200">{business.industry}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Location</dt>
                <dd className="text-right text-slate-200">
                  {business.location.city}, {business.location.state}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Keywords</dt>
                <dd className="text-right text-slate-200">{business.keywords.length} tracked</dd>
              </div>
            </dl>
            <div className="mt-4">
              <GoogleMapsLink
                placeId={business.gbpPlaceId}
                name={business.name}
                address={`${business.location.address}, ${business.location.city}, ${business.location.state} ${business.location.zip}`}
              />
            </div>
          </div>

          {isConnected && business.businessId ? (
            <>
              <GbpPerformanceSetup
                businessId={business.businessId}
                reconnectHref={`/api/google/gbp/connect?businessId=${business.businessId}`}
                platformEmail={user.email ?? undefined}
                storedGoogleEmail={record?.gbp_google_email ?? business.gbpConnection?.googleEmail}
              />
              <GbpDisconnect
                businessId={business.businessId}
                businessName={business.name}
                connectedAt={record?.gbp_connected_at ?? null}
                googleEmail={record?.gbp_google_email ?? business.gbpConnection?.googleEmail}
              />
            </>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white">Google Business Profile</h2>
              <p className="mt-2 text-sm text-slate-400">Not connected.</p>
              <Link
                href="/platform/onboard"
                className="btn-primary mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                Connect Google Business Profile
              </Link>
            </div>
          )}

          <p className="text-center text-sm text-slate-500">
            App login: <span className="text-slate-300">{user.email}</span>
            {(record?.gbp_google_email ?? business.gbpConnection?.googleEmail) && (
              <>
                {" "}
                · Profile manager:{" "}
                <span className="text-slate-300">
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
