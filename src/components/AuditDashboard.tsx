"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import { ensureStrategy } from "@/audit/ensure-strategy";
import AuditDataPanel from "@/components/audit/AuditDataPanel";
import AuditSidebar, { AuditViewHeader } from "@/components/audit/AuditSidebar";
import AuditSummaryStrip from "@/components/audit/AuditSummaryStrip";
import { isAuditView, type AuditView } from "@/components/audit/types";
import ExecutionQueue from "@/components/ExecutionQueue";
import MonthlyReportPanel from "@/components/MonthlyReportPanel";
import PerformancePermissionBanner from "@/components/PerformancePermissionBanner";
import StrategyPanel from "@/components/StrategyPanel";

interface AuditRunnerProps {
  clientId: string;
  businessId?: string;
  gbpConnected?: boolean;
  initialAudit: FullAuditPayload | null;
  initialExecutionTasks?: ExecutionTask[];
}

export default function AuditDashboard({
  clientId,
  businessId,
  gbpConnected = true,
  initialAudit,
  initialExecutionTasks = [],
}: AuditRunnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramView = searchParams.get("view");
  const initialView: AuditView = isAuditView(paramView) ? paramView : "report";

  const [audit, setAudit] = useState<FullAuditPayload | null>(
    initialAudit ? ensureStrategy(initialAudit) : null
  );
  const [view, setViewState] = useState<AuditView>(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setView = useCallback(
    (next: AuditView) => {
      setViewState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const tasks =
    audit?.execution?.tasks?.length ? audit.execution.tasks : initialExecutionTasks;
  const pendingTasks = tasks.filter((t) => t.status === "pending_approval").length;

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, trigger: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setAudit(ensureStrategy(data.audit));
      setView("report");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  if (!audit) {
    return (
      <div className="space-y-6">
        {!gbpConnected && <GbpConnectBanner businessId={businessId} />}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 text-center">
          <p className="text-lg font-medium text-white">Ready to see where you stand?</p>
          <p className="mt-2 text-slate-400">
            {gbpConnected
              ? "Run your first audit to get a monthly report, action plan, and execution queue."
              : "Connect Google Business Profile to run your first live audit."}
          </p>
          {gbpConnected ? (
            <button
              type="button"
              onClick={runAudit}
              disabled={loading}
              className="btn-primary mt-6 rounded-full px-8 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Running audit…" : "Run Full Audit"}
            </button>
          ) : (
            businessId && (
              <Link
                href={`/platform/onboard?businessId=${businessId}`}
                className="btn-primary mt-6 inline-block rounded-full px-8 py-3 text-sm font-semibold text-white"
              >
                Connect Google Business Profile
              </Link>
            )
          )}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!gbpConnected && <GbpConnectBanner businessId={businessId} />}

      {audit.gbp.performance.error && audit.gbp.performance.source !== "api" && (
        <PerformancePermissionBanner
          error={audit.gbp.performance.error}
          businessId={businessId}
        />
      )}

      {audit.gbp.performance.warnings && audit.gbp.performance.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm font-medium text-amber-200">Partial performance data</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-400">
            {audit.gbp.performance.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {audit.period} · Last updated {new Date(audit.completedAt).toLocaleString()}
        </p>
        <button
          type="button"
          onClick={runAudit}
          disabled={loading || !gbpConnected}
          className="btn-primary shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Running audit…" : "Re-run Audit"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <AuditSummaryStrip audit={audit} />

      <div className="flex min-h-[calc(100vh-14rem)] flex-col overflow-hidden rounded-2xl border border-white/8 bg-slate-950/40 lg:flex-row">
        <AuditSidebar active={view} onChange={setView} pendingTasks={pendingTasks} />

        <div className="min-w-0 flex-1 overflow-y-auto p-6 md:p-8">
          <AuditViewHeader view={view} />

          {view === "report" && audit.strategy?.monthlyReport && (
            <MonthlyReportPanel report={audit.strategy.monthlyReport} embedded />
          )}
          {view === "report" && !audit.strategy?.monthlyReport && (
            <p className="text-slate-400">
              Monthly report will appear after your first audit completes.
            </p>
          )}

        {view === "strategy" && audit.strategy && (
          <StrategyPanel strategy={audit.strategy} embedded gbpConnected={gbpConnected} />
        )}

          {view === "execute" && (
            <ExecutionQueue
              key={audit.auditId}
              clientId={clientId}
              auditId={audit.auditId}
              contentSource={audit.execution?.contentSource}
              initialTasks={tasks}
              embedded
            />
          )}

          {view === "data" && <AuditDataPanel audit={audit} embedded />}
        </div>
      </div>
    </div>
  );
}

function GbpConnectBanner({ businessId }: { businessId?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
      <p className="text-sm font-medium text-amber-200">Google Business Profile not connected</p>
      <p className="mt-1 text-sm text-slate-400">
        Connect to pull live reviews, performance metrics, and run full audits.
      </p>
      {businessId && (
        <Link
          href={`/platform/onboard?businessId=${businessId}`}
          className="mt-3 inline-block text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Connect now →
        </Link>
      )}
    </div>
  );
}
