"use client";

import { useMemo } from "react";
import type { FullAuditPayload, Plan } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import type { DailyMetricPoint, ScoreDailySnapshot } from "@/audit/types/timeseries";
import { buildAttributionCalibration, buildGapAttributionCalibration, mergeCalibrations } from "@/audit/phase2/attribution-calibration";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import { buildFieldAttributionCalibration } from "@/audit/phase2/field-attribution-calibration";
import { computeKeywordScores } from "@/audit/phase2/keyword-scores";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import { buildPlan } from "@/audit/phase3/build-plan";
import GapsPanel from "@/components/audit/GapsPanel";
import KeywordScoreCards from "@/components/audit/KeywordScoreCards";
import PathToHealthyPanel from "@/components/audit/PathToHealthyPanel";
import ProfileCommandCenter from "@/components/audit/ProfileCommandCenter";

export default function ListingStrengthInsights({
  audit,
  clientId,
  tasks = [],
  attributions = [],
  avgCustomerValue,
  currency = "USD",
  globalCalibration = {},
  showKeywords = true,
  performancePoints,
  scoreSeries,
  trendsLoading = false,
  onNavigateToPlan,
}: {
  audit: FullAuditPayload;
  clientId?: string;
  tasks?: Parameters<typeof buildPlan>[1];
  attributions?: ActionAttribution[];
  avgCustomerValue?: number | null;
  currency?: string;
  globalCalibration?: AttributionCalibration;
  showKeywords?: boolean;
  performancePoints?: DailyMetricPoint[];
  scoreSeries?: ScoreDailySnapshot[];
  trendsLoading?: boolean;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: "google-updates") => void;
}) {
  const businessCalibration = useMemo(
    () => buildAttributionCalibration(attributions),
    [attributions]
  );

  const gapCalibration = useMemo(
    () => buildGapAttributionCalibration(attributions),
    [attributions]
  );

  const calibration = useMemo(
    () => mergeCalibrations(businessCalibration, globalCalibration),
    [businessCalibration, globalCalibration]
  );

  const fieldCalibration = useMemo(
    () => buildFieldAttributionCalibration(calibration),
    [calibration]
  );

  const plan = useMemo(
    () => buildPlan(audit, tasks, attributions, globalCalibration, avgCustomerValue),
    [audit, tasks, attributions, globalCalibration, avgCustomerValue]
  );

  const path = useMemo(
    () =>
      buildPathToHealthy(audit, plan, {
        avgCustomerValue,
        currency,
        calibration,
        gapCalibration,
      }),
    [audit, plan, avgCustomerValue, currency, calibration, gapCalibration]
  );

  const keywordScores = useMemo(
    () => computeKeywordScores(audit, { avgCustomerValue, currency }),
    [audit, avgCustomerValue, currency]
  );

  if (!path) return null;

  return (
    <div className="space-y-4">
      <PathToHealthyPanel path={path} currency={currency} />
      <ProfileCommandCenter
        audit={audit}
        clientId={clientId}
        tasks={tasks}
        avgCustomerValue={avgCustomerValue}
        currency={currency}
        variant="light"
        fieldCalibration={fieldCalibration}
        performancePoints={performancePoints}
        scoreSeries={scoreSeries}
        trendsLoading={trendsLoading}
        onNavigateToPlan={onNavigateToPlan}
      />
      <GapsPanel audit={audit} avgCustomerValue={avgCustomerValue} currency={currency} />
      {showKeywords && (
        <KeywordScoreCards keywords={keywordScores} currency={currency} />
      )}
      {!avgCustomerValue && keywordScores.some((k) => k.impressions != null) && (
        <p className="text-xs text-[#80868b]">
          Add your average job value in Settings to see revenue estimates per keyword.
        </p>
      )}
    </div>
  );
}
