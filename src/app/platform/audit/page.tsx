import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { getPrimaryBusiness } from "@/audit/businesses";
import { listExecutionTasks } from "@/audit/storage-execution";
import { loadLatestAuditFromSupabase, loadPriorAuditFromSupabase } from "@/audit/storage-supabase";
import AuditDashboard from "@/components/AuditDashboard";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Audit Engine | Reputation Boost",
  description: "Automated Google Business Profile audit and Local 3-Pack strategy.",
  robots: { index: false, follow: false },
};

function formatAddress(location: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  return `${location.address}, ${location.city}, ${location.state} ${location.zip}`;
}

export default async function PlatformAuditPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/platform/audit");

  const business = await getPrimaryBusiness(user.id);
  if (!business) {
    redirect("/platform/onboard");
  }

  const gbpConnected = Boolean(business.onboardingComplete && business.gbpConnection);

  const raw = await loadLatestAuditFromSupabase(user.id, business.id, {
    businessName: business.name,
    businessUuid: business.businessId,
  });
  const priorRaw = raw
    ? await loadPriorAuditFromSupabase(user.id, business.id, raw.completedAt)
    : null;
  const latestAudit = raw ? ensureStrategy(raw, priorRaw) : null;

  const executionTasks =
    latestAudit
      ? await listExecutionTasks(user.id, business.id, latestAudit.auditId)
      : [];

  const initialExecutionTasks =
    executionTasks.length > 0
      ? executionTasks
      : (latestAudit?.execution?.tasks ?? []);

  const businessLocation = {
    lat: business.location.lat,
    lng: business.location.lng,
    address: formatAddress(business.location),
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center p-12 text-[#5f6368]">
            Loading dashboard…
          </div>
        }
      >
        <AuditDashboard
          clientId={business.id}
          businessId={business.businessId}
          businessName={business.name}
          businessIndustry={business.industry}
          businessLocation={businessLocation}
          gbpConnected={gbpConnected}
          initialAudit={latestAudit}
          initialExecutionTasks={initialExecutionTasks}
        />
      </Suspense>
    </main>
  );
}
