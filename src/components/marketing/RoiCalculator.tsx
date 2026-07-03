"use client";

import { useState } from "react";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import SectionHeader from "@/components/marketing/SectionHeader";

const BASE_AVG_JOB = 500;
const BASE_GAIN = 4200;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function RoiCalculator() {
  const [avgJobValue, setAvgJobValue] = useState(500);

  const scale = avgJobValue / BASE_AVG_JOB;
  const projectedGain = Math.round(BASE_GAIN * scale);
  const currentCapture = Math.round(projectedGain * 0.15);
  const projectedCapture = currentCapture + projectedGain;

  return (
    <section id="roi-calculator" className="relative py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeader
          label="Revenue Calculator"
          labelColor="amber"
          title={
            <>
              What&apos;s ranking outside the pack{" "}
              <span className="gradient-text">costing you?</span>
            </>
          }
          subtitle="Enter your average job value to see estimated monthly revenue at your current score vs. after completing your plan."
        />

        <div className="mx-auto mt-12 max-w-xl gradient-border overflow-hidden rounded-2xl">
          <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-8">
            <label htmlFor="avg-job-value" className="block text-sm font-medium text-slate-300">
              Average job / customer value
            </label>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
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
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-8 pr-4 text-lg font-semibold text-white outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-orange-400">
                  Current (score ~47)
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {formatCurrency(currentCapture)}
                </p>
                <p className="mt-1 text-xs text-slate-500">/month from Maps</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                  After plan (score ~72)
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {formatCurrency(projectedCapture)}
                </p>
                <p className="mt-1 text-xs text-slate-500">/month from Maps</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-emerald-500/10 px-4 py-3 text-center">
              <p className="text-sm text-slate-300">
                Estimated monthly gain:{" "}
                <span className="text-lg font-bold text-emerald-400">
                  +{formatCurrency(projectedGain)}
                </span>
              </p>
            </div>

            <a
              href={SIGNUP_URL}
              className="btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white"
            >
              {SIGNUP_CTA_LABEL}
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
