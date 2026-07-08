"use client";

import { useMemo } from "react";
import type { ExecutionTask, FullAuditPayload, GbpLocationInventory, GbpLocationInventoryField } from "@/audit/types";
import { enrichInventoryWithPlanLinks, planTaskStatusStyle } from "@/lib/google/gbp-field-plan-links";
import { enrichLocationInventoryScores } from "@/lib/google/gbp-field-score-impact";
import ProfilePerformanceTrends from "@/components/audit/ProfilePerformanceTrends";
import ProfileAlertsPanel from "@/components/audit/ProfileAlertsPanel";
import { useGbpAlerts } from "@/hooks/useGbpAlerts";
import type { FieldAttributionCalibration } from "@/audit/phase2/field-attribution-calibration";

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

function fieldSummary(field: GbpLocationInventoryField): string {
  if (field.constraint) return field.constraint;
  const current = field.current.trim();
  if (!current) return "";
  return current.length > 96 ? `${current.slice(0, 96)}…` : current;
}

function planStepNumbersFromAudit(
  audit: FullAuditPayload,
  tasks: ExecutionTask[]
): Set<number> {
  const stepNumbers = new Set(
    (audit.strategy.gbpPlan?.steps ?? []).map((step) => step.stepNumber)
  );

  for (const task of tasks) {
    if (task.planStepNumber != null) {
      stepNumbers.add(task.planStepNumber);
    }
  }

  return stepNumbers;
}

export default function ProfileCommandCenter({
  audit,
  clientId,
  tasks = [],
  avgCustomerValue,
  currency = "USD",
  variant = "light",
  fieldCalibration,
  onNavigateToPlan,
}: {
  audit: FullAuditPayload;
  clientId?: string;
  tasks?: ExecutionTask[];
  avgCustomerValue?: number | null;
  currency?: string;
  variant?: "light" | "dark";
  fieldCalibration?: FieldAttributionCalibration;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: GbpLocationInventoryField["planScrollTarget"]) => void;
}) {
  const isLight = variant === "light";
  const baseInventory = audit.gbp.locationInventory;

  const { events: alerts, loading: alertsLoading, error: alertsError, acknowledge } =
    useGbpAlerts(clientId);

  const inventory = useMemo<GbpLocationInventory | null>(() => {
    if (!baseInventory) return null;

    const planStepNumbers = planStepNumbersFromAudit(audit, tasks);
    const withPlanLinks = enrichInventoryWithPlanLinks(baseInventory, tasks, {
      planStepNumbers,
    });
    if (!avgCustomerValue) {
      return enrichLocationInventoryScores(withPlanLinks, { fieldCalibration });
    }

    const monthlyActions =
      audit.gbp.performance.calls +
      audit.gbp.performance.directionRequests +
      audit.gbp.performance.websiteClicks;

    return enrichLocationInventoryScores(withPlanLinks, {
      monthlyActions,
      avgCustomerValue,
      fieldCalibration,
    });
  }, [audit, audit.gbp.performance, audit.strategy.gbpPlan?.steps, avgCustomerValue, baseInventory, fieldCalibration, tasks]);

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

      {clientId && (
        <div className="mt-4">
          <h3
            className={`text-xs font-semibold uppercase tracking-wide ${
              isLight ? "text-[#80868b]" : "text-slate-500"
            }`}
          >
            Active alerts
            {alerts.length > 0 ? ` (${alerts.length})` : ""}
          </h3>
          <div className="mt-2">
            <ProfileAlertsPanel
              events={alerts}
              loading={alertsLoading}
              error={alertsError}
              variant={variant}
              onNavigateToPlan={onNavigateToPlan}
              onDismiss={(eventId) => {
                void acknowledge(eventId).catch(() => undefined);
              }}
            />
          </div>
        </div>
      )}

      {clientId && <ProfilePerformanceTrends clientId={clientId} variant={variant} />}

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
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                    {field.label}
                  </p>
                  {fieldSummary(field) && (
                    <p className={`mt-0.5 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                      {fieldSummary(field)}
                    </p>
                  )}
                </div>
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
            {field.calibrationConfidence && (
              <CalibrationBadge confidence={field.calibrationConfidence} isLight={isLight} />
            )}
            {field.planTaskStatus && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  planTaskStatusStyle(field.planTaskStatus).className
                }`}
              >
                Plan: {planTaskStatusStyle(field.planTaskStatus).label}
              </span>
            )}
          </div>
          <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            {fieldSummary(field)}
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
      {fieldSummary(field) !== field.current.trim() && (
        <p className={`mt-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
          {field.current}
        </p>
      )}
      {field.missingCurrent && (
        <p className={`mt-2 text-sm ${isLight ? "text-[#b06000]" : "text-amber-200"}`}>
          {field.missingCurrent}
        </p>
      )}
      {field.constraint && field.status !== "good" && (
        <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          {field.constraint}
        </p>
      )}
    </div>
  );
}

function CalibrationBadge({
  confidence,
  isLight,
}: {
  confidence: NonNullable<GbpLocationInventoryField["calibrationConfidence"]>;
  isLight: boolean;
}) {
  const label =
    confidence === "high"
      ? "Calibrated"
      : confidence === "medium"
        ? "Calibrated"
        : "Learning";

  const toneClass =
    confidence === "high"
      ? isLight
        ? "bg-[#e6f4ea] text-[#137333]"
        : "bg-emerald-500/10 text-emerald-300"
      : confidence === "medium"
        ? isLight
          ? "bg-[#e8f0fe] text-[#1a73e8]"
          : "bg-blue-500/10 text-blue-300"
        : isLight
          ? "bg-[#fef7e0] text-[#b06000]"
          : "bg-amber-500/10 text-amber-200";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>
      {label}
    </span>
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
