import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuditDashboard from "@/components/AuditDashboard";
import { demoClient } from "@/audit/clients";
import { loadLatestAudit } from "@/audit/storage";

export const metadata: Metadata = {
  title: "Audit Engine | Reputation Boost",
  description: "Phase 1 automated data collection for Google Business Profile and Local 3-Pack audits.",
  robots: { index: false, follow: false },
};

export default async function PlatformAuditPage() {
  const latestAudit = await loadLatestAudit(demoClient.id);

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden pt-32 pb-24">
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
          </div>

          <AuditDashboard clientId={demoClient.id} initialAudit={latestAudit} />
        </div>
      </main>
      <Footer />
    </>
  );
}
