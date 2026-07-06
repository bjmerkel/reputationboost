"use client";

import { useMemo } from "react";
import type { ExecutionTask, FullAuditPayload, GbpLocationInventory, GbpLocationInventoryField } from "@/audit/types";
import { enrichInventoryWithPlanLinks } from "@/lib/google/gbp-field-plan-links";
import { enrichLocationInventoryScores } from "@/lib/google/gbp-field-score-impact";

const SECTION_LABELS: Record<GbpLocationInventoryField["section"], string> = {
  identity: "Identity & categories",
  profile: "Business description",
  hours: "Hours",
  services: "Services",
  attributes: "Attributes",
  service_area: "Service area & location",
  status: "Google profile status",
  engagement: "Engagement",
  performance: "Performance outcomes",
};

const STATUS_STYLES: Record<
  GbpLocationInventoryField["status"],
  { label: string; className: string }
> = {
  good: { label: "Good", className: "bg-[#e6f4ea] text-[#137333]" },
  needs_work: { label: "Needs work", className: "bg-[#fef7e0] text-[#e37400]" },
  missing: { label: "Missing", className: "bg-[#fce8e6] text-[#c5221f]" },
  conflict: { label: "Conflict", className: "bg-[#fce8e6] text-[#c5221f]" },
  processing: { label: "Processing", className: "bg-[#e8f0fe] text-[#1a73e8]" },
  blocked: { label: "Blocked", className: "bg-[#f1f3f4] text-[#5f6368]" },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProfileCommandCenter({
  audit,
  tasks = [],
  avgCustomerValue,
  currency = "USD",
  variant = "light",
  onNavigateToPlan,
}: {
  audit: FullAuditPayload;
  tasks?: ExecutionTask[];
  avgCustomerValue?: number | null;
  currency?: string;
  variant?: "light" | "dark";
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: GbpLocationInventoryField["planScrollTarget"]) => void;
}) {
  const isLight = variant === "light";
  const baseInventory = audit.gbp.locationInventory;

  const inventory = useMemo<GbpLocationInventory | null>(() => {
    if (!baseInventory) return null;

    const withPlanLinks = enrichInventoryWithPlanLinks(baseInventory, tasks);
    if (!avgCustomerValue) return withPlanLinks;

    const monthlyActions =
      audit.gbp.performance.calls +
      audit.gbp.performance.directionRequests +
      audit.gbp.performance.websiteClicks;

    return enrichLocationInventoryScores(withPlanLinks, {
      monthlyActions,
      avgCustomerValue,
    });
  }, [audit.gbp.performance, avgCustomerValue, baseInventory, tasks]);

  if (!inventory) {
    return (
      <section
        className={`rounded-xl border p-5 ${
          isLight ? "border-[#e8eaed] bg-white" : "border-white/10 bg-white/[0.03]"
        }`}
      >
        <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Run a new audit with Google connected to see the full profile field checklist.
        </p>
      </section>
    );
  }

  const actionable = inventory.fields.filter(
    (f) => f.status !== "good" && (f.scoreImpact ?? 0) > 0
  );

  const sections = Object.keys(SECTION_LABELS) as GbpLocationInventoryField["section"][];

  return (
    <section
      className={`rounded-xl border p-5 ${
        isLight ? "border-[#e8eaed] bg-white" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-base font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Profile command center
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Every Google Location field mapped to your Reputation Boost score and conversion actions.
          </p>
        </div>
        <div className="text-right text-sm">
          <p className={`font-semibold ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
            +{inventory.summary.potentialScoreGain ?? 0} potential score pts
          </p>
          {inventory.summary.potentialRevenueGain ? (
            <p className={`${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              est. {formatCurrency(inventory.summary.potentialRevenueGain, currency)}/mo
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <SummaryPill label="Good" value={inventory.summary.good} tone="good" isLight={isLight} />
        <SummaryPill
          label="Needs work"
          value={inventory.summary.needsWork}
          tone="warn"
          isLight={isLight}
        />
        <SummaryPill label="Missing" value={inventory.summary.missing} tone="bad" isLight={isLight} />
        <SummaryPill
          label="Conflicts"
          value={inventory.summary.conflict}
          tone="bad"
          isLight={isLight}
        />
      </div>

      {actionable.length > 0 && (
        <div
          className={`mt-4 rounded-lg border p-3 ${
            isLight ? "border-[#fef7e0] bg-[#fef7e0]" : "border-amber-500/20 bg-amber-500/5"
          }`}
        >
          <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#b06000]" : "text-amber-200"}`}>
            Top priorities
          </p>
          <ul className={`mt-2 space-y-1 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
            {actionable.slice(0, 5).map((field) => (
              <li key={field.apiPath} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {field.label}
                  <span className={`ml-2 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                    {field.apiPath}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
                    +{field.scoreImpact} pts
                    {field.revenueImpact
                      ? ` · ${formatCurrency(field.revenueImpact, currency)}/mo`
                      : ""}
                  </span>
                  {field.planStepNumber != null && onNavigateToPlan && (
                    <FixButton
                      field={field}
                      isLight={isLight}
                      onNavigateToPlan={onNavigateToPlan}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {sections.map((section) => {
          const fields = inventory.fields.filter((f) => f.section === section);
          if (fields.length === 0) return null;

          return (
            <div key={section}>
              <h3
                className={`text-xs font-semibold uppercase tracking-wide ${
                  isLight ? "text-[#80868b]" : "text-slate-500"
                }`}
              >
                {SECTION_LABELS[section]}
              </h3>
              <div className="mt-2 space-y-2">
                {fields.map((field) => (
                  <FieldRow
                    key={field.apiPath}
                    field={field}
                    currency={currency}
                    isLight={isLight}
                    onNavigateToPlan={onNavigateToPlan}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SummaryPill({
  label,
  value,
  tone,
  isLight,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "bad";
  isLight: boolean;
}) {
  const toneClass =
    tone === "good"
      ? isLight
        ? "bg-[#e6f4ea] text-[#137333]"
        : "bg-emerald-500/10 text-emerald-300"
      : tone === "warn"
        ? isLight
          ? "bg-[#fef7e0] text-[#e37400]"
          : "bg-amber-500/10 text-amber-200"
        : isLight
          ? "bg-[#fce8e6] text-[#c5221f]"
          : "bg-red-500/10 text-red-300";

  return (
    <span className={`rounded-full px-2.5 py-1 font-medium ${toneClass}`}>
      {label}: {value}
    </span>
  );
}

function FieldRow({
  field,
  currency,
  isLight,
  onNavigateToPlan,
}: {
  field: GbpLocationInventoryField;
  currency: string;
  isLight: boolean;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: GbpLocationInventoryField["planScrollTarget"]) => void;
}) {
  const status = STATUS_STYLES[field.status];

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
              {field.label}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
              {status.label}
            </span>
            {!field.editable && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isLight ? "bg-[#f1f3f4] text-[#5f6368]" : "bg-white/10 text-slate-400"
                }`}
              >
                Read-only
              </span>
            )}
          </div>
          <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {field.apiPath}
          </p>
        </div>
        {(field.scoreImpact ?? 0) > 0 && (
          <div className="text-right text-xs">
            <p className={`font-semibold ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
              +{field.scoreImpact} pts
            </p>
            {field.revenueImpact ? (
              <p className={isLight ? "text-[#5f6368]" : "text-slate-400"}>
                {formatCurrency(field.revenueImpact, currency)}/mo
              </p>
            ) : null}
          </div>
        )}
        {field.planStepNumber != null && onNavigateToPlan && (
          <FixButton field={field} isLight={isLight} onNavigateToPlan={onNavigateToPlan} />
        )}
      </div>
      <p className={`mt-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
        {field.current}
      </p>
      {field.constraint && field.status !== "good" && (
        <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          {field.constraint}
        </p>
      )}
    </div>
  );
}

function FixButton({
  field,
  isLight,
  onNavigateToPlan,
}: {
  field: GbpLocationInventoryField;
  isLight: boolean;
  onNavigateToPlan: (stepNumber: number, scrollTarget?: GbpLocationInventoryField["planScrollTarget"]) => void;
}) {
  if (field.planStepNumber == null) return null;

  return (
    <button
      type="button"
      onClick={() => onNavigateToPlan(field.planStepNumber!, field.planScrollTarget)}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
        isLight
          ? "bg-[#1a73e8] text-white hover:bg-[#1765cc]"
          : "bg-blue-500 text-white hover:bg-blue-600"
      }`}
    >
      {field.planFixLabel ?? "Fix in plan"}
    </button>
  );
}
