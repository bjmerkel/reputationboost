import type { Metadata } from "next";
import AuditDashboard from "@/components/AuditDashboard";
import { demoClient } from "@/audit/clients";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { isLocalStorageAvailable } from "@/audit/storage-env";
import { loadLatestAudit } from "@/audit/storage";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Audit Engine | Reputation Boost",
  description: "Phase 1 automated data collection for Google Business Profile and Local 3-Pack audits.",
  robots: { index: false, follow: false },
};

export default async function PlatformAuditPage() {
  const user = await getUser();
  const latestAudit =
    (user ? await loadLatestAuditFromSupabase(user.id, demoClient.id) : null) ??
    (isLocalStorageAvailable() ? await loadLatestAudit(demoClient.id) : null);

  return (
    <main className="relative overflow-hidden py-10">
      <div className="mesh-bg absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-10">
          <span className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
            Phase 1 — Data Collection
          </span>
          <h1 className="mt-2 text-4xl font-extrabold text-white">
            Monthly Audit Engine
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Automated harvest of GBP profile data, Local 3-Pack rankings,
            competitor snapshots, review sentiment, and off-Google signals.
          </p>
          {user && (
            <p className="mt-2 text-sm text-slate-500">
              Signed in as <span className="text-slate-300">{user.email}</span>
            </p>
          )}
        </div>

        <AuditDashboard clientId={demoClient.id} initialAudit={latestAudit} />
      </div>
    </main>
  );
}
