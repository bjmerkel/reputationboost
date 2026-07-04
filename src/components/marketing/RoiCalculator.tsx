"use client";

import { useState } from "react";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import SectionHeader from "@/components/marketing/SectionHeader";
import { usePreviewAudit } from "@/context/PreviewAuditContext";

/** Baseline assumptions for illustrative calculator (replaced by audit data after search). */
const BASE_AVG_JOB = 500;
const BASE_GAIN = 4200;
const ASSUMED_LEADS_CURRENT = 18;
const ASSUMED_LEADS_PROJECTED = 42;
const ASSUMED_CLOSE_RATE = 0.25;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RoiCalculator() {
  const { preview, isLive } = usePreviewAudit();
  const [avgJobValue, setAvgJobValue] = useState(500);

  const currentScore = preview?.score.overall;
  const projectedScore = preview?.pathToHealthy.projectedScore;
  const auditGain = preview?.pathToHealthy.estimatedRevenueGain;

  const scale = avgJobValue / BASE_AVG_JOB;
  const illustrativeGain = Math.round(BASE_GAIN * scale);
  const projectedGain = isLive && auditGain != null ? Math.round(auditGain * scale) : illustrativeGain;

  const currentLeads = ASSUMED_LEADS_CURRENT;
  const projectedLeads = ASSUMED_LEADS_PROJECTED;
  const currentCapture = Math.round(currentLeads * ASSUMED_CLOSE_RATE * avgJobValue);
  const projectedCapture = Math.round(projectedLeads * ASSUMED_CLOSE_RATE * avgJobValue);

  const currentLabel =
    isLive && currentScore != null
      ? `Current (score ${currentScore})`
      : "Current (outside Local 3-Pack)";
  const projectedLabel =
    isLive && projectedScore != null
      ? `After plan (score ${projectedScore})`
      : "After plan (healthy score target)";

  return (
    <section id="roi-calculator" className="scroll-mt-28 border-b border-[#dadce0] bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="Revenue Calculator"
          labelColor="amber"
          title={
            <>
              What&apos;s ranking outside the pack{" "}
              <span className="gradient-text font-semibold">costing you?</span>
            </>
          }
          subtitle={
            isLive
              ? "Based on your audit — adjust job value to see how revenue estimates scale."
              : "Enter your average job value for an illustrative estimate. Search your business above for numbers from your listing."
          }
        />

        <div className="mx-auto mt-12 max-w-xl overflow-hidden rounded-xl border border-[#dadce0] bg-[#f8f9fa] shadow-sm">
          <div className="p-8">
            <label htmlFor="avg-job-value" className="block text-sm font-medium text-[#3c4043]">
              Average job / customer value
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#80868b]">
                $
              </span>
              <input
                id="avg-job-value"
                type="number"
                min={50}
                max={50000}
                step={50}
                value={avgJobValue}
                onChange={(e) => setAvgJobValue(Math.max(50, Number(e.target.value) || 50))}
                className="w-full rounded-lg border border-[#dadce0] bg-white py-3 pl-8 pr-4 text-lg font-semibold text-[#202124] outline-none transition-colors focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
              />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[#fdd663] bg-[#fef7e0] p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-[#e37400]">
                  {currentLabel}
                </p>
                <p className="mt-2 text-2xl font-bold text-[#202124]">
                  {formatCurrency(currentCapture)}
                </p>
                <p className="mt-1 text-xs text-[#80868b]">/month from Maps</p>
              </div>
              <div className="rounded-lg border border-[#ceead6] bg-[#e6f4ea] p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-[#188038]">
                  {projectedLabel}
                </p>
                <p className="mt-2 text-2xl font-bold text-[#202124]">
                  {formatCurrency(projectedCapture)}
                </p>
                <p className="mt-1 text-xs text-[#80868b]">/month from Maps</p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-[#ceead6] bg-[#e6f4ea] px-4 py-3 text-center">
              <p className="text-sm text-[#3c4043]">
                Estimated monthly gain:{" "}
                <span className="text-lg font-bold text-[#188038]">
                  +{formatCurrency(projectedGain)}
                </span>
              </p>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[#80868b]">
              {isLive ? (
                <>
                  Methodology: Uses your audit&apos;s revenue estimate, scaled by job
                  value. Assumes more Maps-driven leads as you move into the Local 3-Pack.
                </>
              ) : (
                <>
                  Methodology: Illustrative only — assumes ~{currentLeads} Maps-driven leads/mo
                  outside the Local 3-Pack vs. ~{projectedLeads}/mo in the top 3, at a{" "}
                  {Math.round(ASSUMED_CLOSE_RATE * 100)}% close rate. Your free audit replaces
                  these defaults with data from your listing.
                </>
              )}
            </p>

            <a
              href={isLive ? SIGNUP_URL : "#hero-search"}
              className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white"
            >
              {isLive ? SIGNUP_CTA_LABEL : "Search your business for your numbers"}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
