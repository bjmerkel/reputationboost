"use client";

import { useMemo } from "react";
import type { FullAuditPayload, Plan } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { buildAttributionCalibration, mergeCalibrations } from "@/audit/phase2/attribution-calibration";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import { computeKeywordScores } from "@/audit/phase2/keyword-scores";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import { buildPlan } from "@/audit/phase3/build-plan";
import KeywordScoreCards from "@/components/audit/KeywordScoreCards";
import PathToHealthyPanel from "@/components/audit/PathToHealthyPanel";

export default function ListingStrengthInsights({
  audit,
  tasks = [],
  attributions = [],
  avgCustomerValue,
  currency = "USD",
  globalCalibration = {},
  showKeywords = true,
}: {
  audit: FullAuditPayload;
  tasks?: Parameters<typeof buildPlan>[1];
  attributions?: ActionAttribution[];
  avgCustomerValue?: number | null;
  currency?: string;
  globalCalibration?: AttributionCalibration;
  showKeywords?: boolean;
}) {
  const businessCalibration = useMemo(
    () => buildAttributionCalibration(attributions),
    [attributions]
  );

  const calibration = useMemo(
    () => mergeCalibrations(businessCalibration, globalCalibration),
    [businessCalibration, globalCalibration]
  );

  const plan = useMemo(
    () => buildPlan(audit, tasks, attributions, globalCalibration),
    [audit, tasks, attributions, globalCalibration]
  );

  const path = useMemo(
    () =>
      buildPathToHealthy(audit, plan, {
        avgCustomerValue,
        currency,
        calibration,
      }),
    [audit, plan, avgCustomerValue, currency, calibration]
  );

  const keywordScores = useMemo(
    () => computeKeywordScores(audit, { avgCustomerValue, currency }),
    [audit, avgCustomerValue, currency]
  );

  if (!path) return null;

  return (
    <div className="space-y-4">
      <PathToHealthyPanel path={path} />
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
