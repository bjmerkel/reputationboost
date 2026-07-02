import type { Metadata } from "next";
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
  if (!business?.onboardingComplete || !business.gbpConnection) {
    redirect("/platform/onboard");
  }

  const raw = await loadLatestAuditFromSupabase(user.id, business.id);
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
    <main className="relative overflow-hidden py-10">
      <div className="mesh-bg absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Audit · Strategy · Execution
          </span>
          <h1 className="mt-2 text-4xl font-extrabold text-white">
            {business.name}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Live data from your connected Google Business Profile — rankings,
            reviews, competitors, and AI-powered monthly automation.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Signed in as <span className="text-slate-300">{user.email}</span>
            {business.gbpConnection && (
              <span className="ml-3 text-emerald-400/80">· GBP connected</span>
            )}
          </p>
        </div>

        <AuditDashboard
          clientId={business.id}
          initialAudit={latestAudit}
          initialExecutionTasks={initialExecutionTasks}
        />
      </div>
    </main>
  );
}
