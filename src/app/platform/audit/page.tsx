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

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <div className="mesh-bg absolute inset-0" />
      <div className="relative flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{business.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Select a section from the sidebar to review results, plan, and take action.
          </p>
        </div>

        <div className="min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 text-center text-slate-400">
                Loading dashboard…
              </div>
            }
          >
            <AuditDashboard
              clientId={business.id}
              businessId={business.businessId}
              gbpConnected={gbpConnected}
              initialAudit={latestAudit}
              initialExecutionTasks={initialExecutionTasks}
            />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
