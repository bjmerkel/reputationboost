"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import { ensureStrategy } from "@/audit/ensure-strategy";
import ResultsView from "@/components/results/ResultsView";
import { normalizeAuditView, type AuditView } from "@/components/audit/types";
import MonthlyReportPanel from "@/components/MonthlyReportPanel";
import PerformancePermissionBanner from "@/components/PerformancePermissionBanner";
import MapsSearchBar from "@/components/platform/MapsSearchBar";
import PlaceCard from "@/components/platform/PlaceCard";
import PlaceCardReviewsPanel from "@/components/platform/PlaceCardReviewsPanel";
import PlatformShell from "@/components/platform/PlatformShell";
import RankingMap from "@/components/platform/RankingMap";
import ViewAsCustomerModal from "@/components/platform/ViewAsCustomerModal";
import HomeView from "@/components/home/HomeView";
import BatchReviewSession from "@/components/plan/BatchReviewSession";
import PlanView from "@/components/plan/PlanView";
import { useAttributionDashboard } from "@/hooks/useAttributionDashboard";

interface BusinessLocation {
  lat: number;
  lng: number;
  address: string;
}

interface AuditRunnerProps {
  clientId: string;
  businessId?: string;
  businessName: string;
  businessLocation: BusinessLocation;
  gbpConnected?: boolean;
  initialAudit: FullAuditPayload | null;
  initialExecutionTasks?: ExecutionTask[];
}

export default function AuditDashboard({
  clientId,
  businessId,
  businessName,
  businessLocation,
  gbpConnected = true,
  initialAudit,
  initialExecutionTasks = [],
}: AuditRunnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramView = searchParams.get("view");
  const normalizedView = normalizeAuditView(paramView);

  const [audit, setAudit] = useState<FullAuditPayload | null>(
    initialAudit ? ensureStrategy(initialAudit) : null
  );
  const [view, setViewState] = useState<AuditView>(normalizedView);
  const [activeKeyword, setActiveKeyword] = useState(
    () => initialAudit?.rankings.keywords[0]?.keyword ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);

  const reviewParam = searchParams.get("review");

  const { data: attributionData, loading: attributionLoading } = useAttributionDashboard(clientId);

  const openBatchReview = useCallback(() => {
    setBatchReviewOpen(true);
  }, []);

  useEffect(() => {
    if (reviewParam === "pending" && audit) {
      setBatchReviewOpen(true);
    }
  }, [reviewParam, audit]);

  const setView = useCallback(
    (next: AuditView) => {
      setViewState(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (paramView && paramView !== normalizedView) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", normalizedView);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    setViewState(normalizedView);
  }, [paramView, normalizedView, router, searchParams]);

  const tasks =
    audit?.execution?.tasks?.length ? audit.execution.tasks : initialExecutionTasks;

  const planPendingCount = tasks.filter((t) => t.status === "pending_approval").length;
  const pendingReviewReplies = tasks.filter(
    (t) => t.type === "review_response" && t.status === "pending_approval"
  ).length;

  const keywordRank = useMemo(() => {
    if (!audit) return undefined;
    return (
      audit.rankings.keywords.find((k) => k.keyword === activeKeyword) ??
      audit.rankings.keywords[0]
    );
  }, [audit, activeKeyword]);

  const activeCompetitors = useMemo(() => {
    if (!audit) return [];
    const snap =
      audit.competitors.find((c) => c.keyword === activeKeyword) ??
      audit.competitors[0];
    return snap?.competitors ?? [];
  }, [audit, activeKeyword]);

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
      const nextAudit = ensureStrategy(data.audit);
      setAudit(nextAudit);
      if (nextAudit.rankings.keywords[0]) {
        setActiveKeyword(nextAudit.rankings.keywords[0].keyword);
      }
      setView("report");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  if (!audit) {
    return (
      <div className="space-y-4">
        {!gbpConnected && <GbpConnectBanner businessId={businessId} />}
        <div className="rounded-xl border border-[#dadce0] bg-white p-12 text-center shadow-[var(--platform-shadow)]">
          <p className="text-lg font-medium text-[#202124]">Ready to see where you stand?</p>
          <p className="mt-2 text-sm text-[#5f6368]">
            {gbpConnected
              ? "Run your first audit to see your listing on the map, performance metrics, and optimization plan."
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
          {error && <p className="mt-4 text-sm text-[#d93025]">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {!gbpConnected && <div className="shrink-0"><GbpConnectBanner businessId={businessId} /></div>}

      {audit.gbp.performance.source !== "api" && audit.gbp.performance.accessCheck && (
        <div className="shrink-0">
          <PerformancePermissionBanner
            accessCheck={audit.gbp.performance.accessCheck}
            businessId={businessId}
            variant="light"
          />
        </div>
      )}

      {audit.gbp.performance.warnings && audit.gbp.performance.warnings.length > 0 && (
        <div className="mb-3 shrink-0 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-4 py-3">
          <p className="text-sm text-[#5f6368]">
            Some Google insights are limited for this location. Your audit still includes
            everything else.
          </p>
        </div>
      )}

      {error && <p className="mb-3 shrink-0 text-sm text-[#d93025]">{error}</p>}

      <PlatformShell
        searchBar={
          <MapsSearchBar
            businessName={businessName}
            keywords={audit.rankings.keywords}
            activeKeyword={activeKeyword}
            onKeywordChange={setActiveKeyword}
          />
        }
        toolbar={
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <button
              type="button"
              onClick={runAudit}
              disabled={loading || !gbpConnected}
              className="btn-primary shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh data"}
            </button>
            <p className="hidden text-[10px] text-[#80868b] sm:block">
              {audit.period} · {new Date(audit.completedAt).toLocaleDateString()}
            </p>
          </div>
        }
      >
        <PlaceCard
          audit={audit}
          activeView={view}
          onViewChange={setView}
          planPendingCount={planPendingCount}
          onPreviewCustomer={() => setPreviewOpen(true)}
          sparklines={attributionData.sparklines}
        >
          {view === "report" && (
            <HomeView
              audit={audit}
              tasks={tasks}
              summary={attributionData.summary}
              attributions={attributionData.attributions}
              attributionLoading={attributionLoading}
              onReviewPending={openBatchReview}
            />
          )}

          {view === "report" && audit.strategy?.monthlyReport && (
            <MonthlyReportPanel report={audit.strategy.monthlyReport} embedded variant="light" />
          )}
          {view === "report" && !audit.strategy?.monthlyReport && (
            <p className="text-sm text-[#5f6368]">
              Your monthly overview will appear after your first audit completes.
            </p>
          )}

          {view === "reviews" && (
            <PlaceCardReviewsPanel
              audit={audit}
              unrespondedCount={pendingReviewReplies}
              onOpenPlan={openBatchReview}
            />
          )}

          {view === "strategy" && audit.strategy && (
            <PlanView
              audit={audit}
              clientId={clientId}
              gbpConnected={gbpConnected}
              attributionByTaskId={attributionData.attributionByTaskId}
              variant="light"
              onReviewPending={openBatchReview}
            />
          )}

          {view === "data" && (
            <ResultsView
              audit={audit}
              clientId={clientId}
              tasks={tasks}
              attributions={attributionData.attributions}
              summary={attributionData.summary}
              attributionLoading={attributionLoading}
              activeKeyword={activeKeyword}
              onKeywordChange={setActiveKeyword}
              gbpConnected={gbpConnected}
            />
          )}
        </PlaceCard>

        <div className="relative flex min-h-[200px] w-full flex-[0_0_40%] flex-col overflow-hidden lg:min-h-0 lg:flex-[0_0_60%] lg:self-stretch">
          <RankingMap
            lat={businessLocation.lat}
            lng={businessLocation.lng}
            address={businessLocation.address}
            businessName={businessName}
            keywordRank={keywordRank}
            competitors={activeCompetitors}
            activeKeyword={activeKeyword}
          />
        </div>
      </PlatformShell>

      <ViewAsCustomerModal
        audit={audit}
        tasks={tasks}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      <BatchReviewSession
        open={batchReviewOpen}
        onClose={() => setBatchReviewOpen(false)}
        clientId={clientId}
        auditId={audit.auditId}
        gbpConnected={gbpConnected}
        initialTasks={tasks}
        attributionByTaskId={attributionData.attributionByTaskId}
      />
    </div>
  );
}

function GbpConnectBanner({ businessId }: { businessId?: string }) {
  return (
    <div className="mb-3 rounded-lg border border-[#fdd663] bg-[#fef7e0] px-4 py-3">
      <p className="text-sm font-medium text-[#3c4043]">Google Business Profile not connected</p>
      <p className="mt-1 text-sm text-[#5f6368]">
        Connect to pull live reviews, performance metrics, and run full audits.
      </p>
      {businessId && (
        <Link
          href={`/platform/onboard?businessId=${businessId}`}
          className="mt-2 inline-block text-sm font-semibold text-[#1a73e8] hover:underline"
        >
          Connect now →
        </Link>
      )}
    </div>
  );
}
