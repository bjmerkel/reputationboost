"use client";

import { useMemo } from "react";
import type { ExecutionTask, FullAuditPayload } from "@/audit/types";
import type { ActionAttribution, AttributionSummary } from "@/audit/types/timeseries";
import type { EngagementPeriodSummary } from "@/audit/engagement-period";
import { buildRollingEngagementHeadline } from "@/audit/engagement-period";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import { buildPlan } from "@/audit/phase3/build-plan";
import { buildPlanTimeline } from "@/audit/phase3/build-timeline";
import { resolveAcvCopyFromAudit } from "@/lib/business/acv-copy";
import ProfilePerformanceTrends from "@/components/audit/ProfilePerformanceTrends";
import EngagementPeriodCard from "@/components/engagement/EngagementPeriodCard";
import RoiSummaryCard from "@/components/attribution/RoiSummaryCard";
import PlanResultsTimeline from "./PlanResultsTimeline";

export default function ResultsView({
  audit,
  clientId,
  tasks,
  attributions,
  summary,
  engagement,
  attributionLoading = false,
  engagementLoading = false,
  avgCustomerValue,
  globalCalibration = {},
  focusStep = null,
  onFocusHandled,
  onNavigateToPlan,
}: {
  audit: FullAuditPayload;
  clientId: string;
  tasks: ExecutionTask[];
  attributions: ActionAttribution[];
  summary: AttributionSummary | null;
  engagement: EngagementPeriodSummary | null;
  attributionLoading?: boolean;
  engagementLoading?: boolean;
  avgCustomerValue?: number | null;
  globalCalibration?: AttributionCalibration;
  focusStep?: number | null;
  onFocusHandled?: () => void;
  onNavigateToPlan?: (stepNumber: number) => void;
}) {
  const timelineEntries = useMemo(() => {
    const plan = buildPlan(
      audit,
      tasks,
      attributions,
      globalCalibration,
      avgCustomerValue
    );
    return buildPlanTimeline(audit, plan, attributions);
  }, [audit, tasks, attributions, globalCalibration, avgCustomerValue]);

  const attributionsById = useMemo(
    () => Object.fromEntries(attributions.map((attr) => [attr.id, attr])),
    [attributions]
  );

  const rollingHeadline = engagement ? buildRollingEngagementHeadline(engagement) : null;
  const acvCopy = useMemo(() => resolveAcvCopyFromAudit(audit), [audit]);

  return (
    <div className="space-y-6">
      <EngagementPeriodCard
        engagement={engagement}
        attribution={summary}
        loading={engagementLoading || attributionLoading}
        variant="section"
        headline={rollingHeadline}
      />

      <RoiSummaryCard summary={summary} loading={attributionLoading} acvCopy={acvCopy} />

      <ProfilePerformanceTrends
        clientId={clientId}
        days={30}
        variant="light"
        audit={audit}
      />

      <PlanResultsTimeline
        entries={timelineEntries}
        attributionsById={attributionsById}
        loading={attributionLoading}
        focusStep={focusStep}
        onFocusHandled={onFocusHandled}
        onNavigateToPlan={onNavigateToPlan}
      />
    </div>
  );
}
