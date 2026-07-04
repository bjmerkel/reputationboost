"use client";

import { useMemo, useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
import { estimateStepHealthImpact } from "@/audit/phase2/score-impact";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import { computeKeywordScores } from "@/audit/phase2/keyword-scores";
import { buildPlan } from "@/audit/phase3/build-plan";
import ListingStrengthInsights from "@/components/audit/ListingStrengthInsights";
import { normalizeAuditView, type AuditView } from "@/components/audit/types";
import HomeHealthSummary from "@/components/home/HomeHealthSummary";
import MapsSearchBar from "@/components/platform/MapsSearchBar";
import PlaceCard from "@/components/platform/PlaceCard";
import PlaceCardReviewsPanel from "@/components/platform/PlaceCardReviewsPanel";
import PlatformShell from "@/components/platform/PlatformShell";
import RankingMap from "@/components/platform/RankingMap";
import ViewAsCustomerModal from "@/components/platform/ViewAsCustomerModal";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

interface PlatformDemoProps {
  audit: FullAuditPayload;
  businessName: string;
  industry: string;
  location: { lat: number; lng: number; address: string };
  isLive?: boolean;
}

function PlatformDemoPlan({ audit }: { audit: FullAuditPayload }) {
  const steps = audit.strategy?.gbpPlan?.steps ?? [];
  const pendingCount = audit.execution?.tasks.filter((t) => t.status === "pending_approval").length ?? 0;

  if (steps.length === 0) {
    return <p className="text-sm text-[#5f6368]">Your personalized plan will appear after audit.</p>;
  }

  const phases = [
    { id: "foundation", label: "Foundation", range: [1, 4] },
    { id: "content", label: "Content Engine", range: [5, 8] },
    { id: "reputation", label: "Reputation", range: [9, 12] },
    { id: "ongoing", label: "Ongoing", range: [13, 16] },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#d2e3fc] bg-[#e8f0fe] px-4 py-3 text-sm text-[#1a73e8]">
        {pendingCount > 0
          ? `${pendingCount} AI-drafted actions ready for your approval — sign up to publish to Google.`
          : "16 prioritized steps with projected score impact for each action."}
      </div>

      {phases.map((phase) => {
        const phaseSteps = steps.filter(
          (step) =>
            step.stepNumber >= phase.range[0] && step.stepNumber <= phase.range[1]
        );
        if (phaseSteps.length === 0) return null;

        return (
          <div key={phase.id}>
            <h3 className="text-sm font-semibold text-[#202124]">{phase.label}</h3>
            <div className="mt-2 space-y-2">
              {phaseSteps.slice(0, 4).map((step) => {
                const impact = estimateStepHealthImpact(audit, step.stepNumber);
                return (
                <div
                  key={step.stepNumber}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#e8eaed] bg-[#f8f9fa] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#202124]">{step.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#5f6368]">{step.instruction}</p>
                  </div>
                  {impact > 0 && (
                    <span className="shrink-0 rounded-full bg-[#ceead6] px-2 py-0.5 text-xs font-semibold text-[#188038]">
                      +{impact}
                    </span>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        );
      })}

      <a
        href={SIGNUP_URL}
        className="btn-primary inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium text-white"
      >
        {SIGNUP_CTA_LABEL} to approve &amp; publish
      </a>
    </div>
  );
}

function PlatformDemoResults({
  audit,
  activeKeyword,
  onKeywordChange,
}: {
  audit: FullAuditPayload;
  activeKeyword: string;
  onKeywordChange: (keyword: string) => void;
}) {
  const tasks = audit.execution?.tasks ?? [];
  const plan = buildPlan(audit, tasks, []);
  const keywordCards = computeKeywordScores(audit).slice(0, 3);
  const path = buildPathToHealthy(audit, plan);

  return (
    <div className="space-y-5">
      {path && (
        <div className="rounded-lg border border-[#dadce0] bg-[#f8f9fa] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            Path to healthy
          </p>
          <p className="mt-2 text-lg font-semibold text-[#202124]">
            {path.currentScore} → <span className="text-[#188038]">{path.projectedScore}</span>
          </p>
          {path.estimatedRevenueGainLabel && (
            <p className="mt-1 text-sm font-medium text-[#188038]">{path.estimatedRevenueGainLabel}</p>
          )}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
          Keyword performance
        </p>
        <div className="mt-2 space-y-2">
          {keywordCards.map((card) => (
            <button
              key={card.keyword}
              type="button"
              onClick={() => onKeywordChange(card.keyword)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                card.keyword === activeKeyword
                  ? "border-[#1a73e8] bg-[#e8f0fe]"
                  : "border-[#e8eaed] bg-[#f8f9fa] hover:border-[#dadce0]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#202124]">{card.keyword}</span>
                <span className="text-xs font-semibold text-[#5f6368]">
                  Vis {card.visibilityScore}
                </span>
              </div>
              {card.potentialAtRank1 != null && (
                <p className="mt-1 text-xs text-[#188038]">
                  ${card.potentialAtRank1.toLocaleString()}/mo at #1
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {plan && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            Plan progress
          </p>
          <p className="mt-2 text-sm text-[#3c4043]">
            {plan.progress.completedSteps} of {plan.progress.totalSteps} steps complete ·{" "}
            {plan.progress.needsApproval} awaiting approval
          </p>
        </div>
      )}
    </div>
  );
}

export default function PlatformDemo({
  audit,
  businessName,
  industry,
  location,
  isLive = false,
}: PlatformDemoProps) {
  const [view, setView] = useState<AuditView>("report");
  const [activeKeyword, setActiveKeyword] = useState(
    () => audit.rankings.keywords[0]?.keyword ?? ""
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const tasks = audit.execution?.tasks ?? [];
  const planPendingCount = tasks.filter((t) => t.status === "pending_approval").length;

  const keywordRank = useMemo(() => {
    return (
      audit.rankings.keywords.find((k) => k.keyword === activeKeyword) ??
      audit.rankings.keywords[0]
    );
  }, [audit, activeKeyword]);

  const activeCompetitors = useMemo(() => {
    if (!activeKeyword) return [];
    return (
      audit.competitors.find((c) => c.keyword === activeKeyword)?.competitors ??
      audit.competitors[0]?.competitors ??
      []
    );
  }, [audit.competitors, activeKeyword]);

  return (
    <div className="platform-theme google-maps-frame overflow-hidden bg-white">
      {isLive && (
        <div className="border-b border-[#d2e3fc] bg-[#e8f0fe] px-4 py-2 text-center text-sm text-[#1a73e8]">
          Live audit for <span className="font-semibold">{businessName}</span>
          {" — "}
          pan the map, switch keywords, open Plan &amp; Reviews
        </div>
      )}

      <div className="h-[min(88vh,900px)] min-h-[520px]">
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
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="shrink-0 rounded-full border border-[#dadce0] bg-white px-4 py-2 text-sm font-medium text-[#1a73e8] hover:bg-[#f8f9fa]"
            >
              View as customer
            </button>
          }
        >
          <PlaceCard
            audit={audit}
            activeView={view}
            onViewChange={(next) => setView(normalizeAuditView(next))}
            planPendingCount={planPendingCount}
            onPreviewCustomer={() => setPreviewOpen(true)}
            industry={industry}
          >
            {view === "report" && (
              <div className="space-y-6">
                <HomeHealthSummary audit={audit} summary={null} />
                <ListingStrengthInsights audit={audit} tasks={tasks} attributions={[]} />
              </div>
            )}

            {view === "strategy" && <PlatformDemoPlan audit={audit} />}

            {view === "reviews" && (
              <PlaceCardReviewsPanel
                audit={audit}
                unrespondedCount={
                  tasks.filter(
                    (t) => t.type === "review_response" && t.status === "pending_approval"
                  ).length
                }
              />
            )}

            {view === "data" && (
              <PlatformDemoResults
                audit={audit}
                activeKeyword={activeKeyword}
                onKeywordChange={setActiveKeyword}
              />
            )}
          </PlaceCard>

          <div className="h-full w-full">
            <RankingMap
              lat={location.lat}
              lng={location.lng}
              address={location.address}
              businessName={businessName}
              keywordRank={keywordRank}
              competitors={activeCompetitors}
              activeKeyword={activeKeyword}
              disableGridFetch
            />
          </div>
        </PlatformShell>
      </div>

      <ViewAsCustomerModal
        audit={audit}
        tasks={tasks}
        industry={industry}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
