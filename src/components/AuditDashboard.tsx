"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import { ensureStrategy } from "@/audit/ensure-strategy";
import AuditDataPanel from "@/components/audit/AuditDataPanel";
import { isAuditView, type AuditView } from "@/components/audit/types";
import ExecutionQueue from "@/components/ExecutionQueue";
import MonthlyReportPanel from "@/components/MonthlyReportPanel";
import PerformancePermissionBanner from "@/components/PerformancePermissionBanner";
import PhotosPanel from "@/components/PhotosPanel";
import MapsSearchBar from "@/components/platform/MapsSearchBar";
import ListingDiffCards from "@/components/platform/ListingDiffCards";
import PlaceCard from "@/components/platform/PlaceCard";
import PlaceCardReviewsPanel from "@/components/platform/PlaceCardReviewsPanel";
import PlatformShell from "@/components/platform/PlatformShell";
import RankingMap from "@/components/platform/RankingMap";
import ViewAsCustomerModal from "@/components/platform/ViewAsCustomerModal";
import StrategyPanel from "@/components/StrategyPanel";
import RoiSummaryCard from "@/components/attribution/RoiSummaryCard";
import ActionAttributionFeed from "@/components/attribution/ActionAttributionFeed";
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
  const initialView: AuditView = isAuditView(paramView) ? paramView : "report";

  const [audit, setAudit] = useState<FullAuditPayload | null>(
    initialAudit ? ensureStrategy(initialAudit) : null
  );
  const [view, setViewState] = useState<AuditView>(initialView);
  const [activeKeyword, setActiveKeyword] = useState(
    () => initialAudit?.rankings.keywords[0]?.keyword ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: attributionData, loading: attributionLoading } = useAttributionDashboard(clientId);

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

  const photoTasks = tasks.filter((t) => t.type === "gbp_photo");
  const actionTasks = tasks.filter((t) => t.type !== "gbp_photo" && t.type !== "gbp_video");

  const pendingPhotoTasks = photoTasks.filter((t) => t.status === "pending_approval").length;
  const pendingTasks = actionTasks.filter((t) => t.status === "pending_approval").length;
  const pendingReviewReplies = actionTasks.filter(
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
    <div className="flex min-h-0 flex-1 flex-col">
      {!gbpConnected && <GbpConnectBanner businessId={businessId} />}

      {audit.gbp.performance.source !== "api" && audit.gbp.performance.accessCheck && (
        <PerformancePermissionBanner
          accessCheck={audit.gbp.performance.accessCheck}
          businessId={businessId}
          variant="light"
        />
      )}

      {audit.gbp.performance.warnings && audit.gbp.performance.warnings.length > 0 && (
        <div className="mb-3 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-4 py-3">
          <p className="text-sm text-[#5f6368]">
            Some Google insights are limited for this location. Your audit still includes
            everything else.
          </p>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-[#d93025]">{error}</p>}

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
          pendingTasks={pendingTasks}
          pendingPhotoTasks={pendingPhotoTasks}
          unrespondedReviews={audit.reviews.unrespondedNegative}
          onPreviewCustomer={() => setPreviewOpen(true)}
          sparklines={attributionData.sparklines}
        >
          {view === "report" && (
            <div className="space-y-6">
              <RoiSummaryCard
                summary={attributionData.summary}
                loading={attributionLoading}
              />
              <ActionAttributionFeed
                attributions={attributionData.attributions}
                loading={attributionLoading}
              />
              <ListingDiffCards
                audit={audit}
                clientId={clientId}
                auditId={audit.auditId}
                tasks={tasks}
                onViewAll={() => setView("execute")}
              />
            </div>
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
              onOpenUpdates={() => setView("execute")}
            />
          )}

          {view === "strategy" && audit.strategy && (
            <StrategyPanel
              strategy={audit.strategy}
              embedded
              variant="light"
              gbpConnected={gbpConnected}
              onOpenPhotos={() => setView("photos")}
            />
          )}

          {view === "photos" && (
            <PhotosPanel
              audit={audit}
              clientId={clientId}
              auditId={audit.auditId}
              gbpConnected={gbpConnected}
              initialTasks={tasks}
              variant="light"
            />
          )}

          {view === "execute" && (
            <ExecutionQueue
              key={audit.auditId}
              clientId={clientId}
              auditId={audit.auditId}
              contentSource={audit.execution?.contentSource}
              initialTasks={actionTasks}
              attributionByTaskId={attributionData.attributionByTaskId}
              embedded
              variant="light"
            />
          )}

          {view === "data" && (
            <AuditDataPanel
              audit={audit}
              clientId={clientId}
              activeKeyword={activeKeyword}
              onKeywordChange={setActiveKeyword}
              embedded
              variant="light"
              gbpConnected={gbpConnected}
            />
          )}
        </PlaceCard>

        <div className="relative h-[38vh] min-h-[220px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
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
