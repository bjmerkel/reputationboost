"use client";

import { useState } from "react";
import type { GbpOptimizationPlan, GbpPlanActionType, GbpPlanStep } from "@/audit/types";

interface GbpOptimizationPlanPanelProps {
  plan: GbpOptimizationPlan;
  gbpConnected?: boolean;
}

export default function GbpOptimizationPlanPanel({
  plan,
  gbpConnected = false,
}: GbpOptimizationPlanPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(plan.steps[0]?.stepNumber ?? 1);

  return (
    <div className="space-y-6">
      {gbpConnected && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Connected to Google Business Profile — use <strong>Apply to GBP</strong> on supported
          steps to publish changes directly. No need to log into Google manually.
        </div>
      )}

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 md:p-6">
        <h3 className="text-lg font-bold text-white">{plan.title}</h3>
        <p className="mt-1 text-sm font-medium text-slate-300">{plan.businessName}</p>
        <p className="text-sm text-slate-500">{plan.address}</p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Target keywords
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.targetKeywords.map((kw) => (
              <span
                key={kw}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">{plan.objective}</p>
        {plan.contentSource === "llm" && (
          <span className="mt-3 inline-block rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-medium text-violet-300">
            AI-generated comprehensive plan
          </span>
        )}
      </div>

      {plan.keywordPriority.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Keyword priority
          </h4>
          <ol className="mt-3 space-y-2">
            {plan.keywordPriority.map((kp) => (
              <li key={kp.keyword} className="flex gap-3 text-sm">
                <span className="font-bold text-emerald-400">{kp.rank}.</span>
                <span>
                  <span className="font-medium text-white">{kp.keyword}</span>
                  <span className="text-slate-400"> — {kp.reason}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        {plan.steps.map((step) => {
          const isOpen = expanded === step.stepNumber;
          return (
            <div
              key={step.stepNumber}
              className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : step.stepNumber)}
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03] md:px-5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-400">
                  {step.stepNumber}
                </span>
                <span className="min-w-0 flex-1 font-semibold text-white">{step.title}</span>
                {step.gbpAction && step.gbpAction !== "manual" && gbpConnected && (
                  <span className="hidden shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400 sm:inline">
                    One-click
                  </span>
                )}
                <span className="shrink-0 text-slate-500">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-white/8 px-4 pb-5 pt-2 md:px-5">
                  <p className="text-sm leading-relaxed text-slate-300">{step.instruction}</p>

                  {step.recommended && (
                    <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xs font-semibold uppercase text-emerald-400">
                        Recommended
                      </p>
                      <p className="mt-1 text-sm text-slate-200">{step.recommended}</p>
                    </div>
                  )}

                  {step.bullets && step.bullets.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {step.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-2 text-sm text-slate-300 before:shrink-0 before:text-emerald-400 before:content-['•']"
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}

                  {step.copyBlocks?.map((block) => (
                    <div key={block.label} className="mt-4 rounded-lg bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {block.label}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                        {block.content}
                      </p>
                    </div>
                  ))}

                  <GbpApplyButton step={step} gbpConnected={gbpConnected} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CadenceCard title="Weekly cadence" items={plan.weeklyCadence} />
        <CadenceCard title="Monthly cadence" items={plan.monthlyCadence} />
      </div>
    </div>
  );
}

function GbpApplyButton({
  step,
  gbpConnected,
}: {
  step: GbpPlanStep;
  gbpConnected: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const action = step.gbpAction;
  if (!action || action === "manual") return null;

  if (!gbpConnected) {
    return (
      <p className="mt-4 text-xs text-slate-500">
        Connect Google Business Profile in Settings to apply this step directly.
      </p>
    );
  }

  const label = applyLabel(action, step);

  async function handleApply() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = buildPayload(action!, step);
      const res = await fetch("/api/google/gbp/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setResult(data.message ?? "Applied successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 border-t border-white/8 pt-4">
      <button
        type="button"
        onClick={handleApply}
        disabled={loading}
        className="btn-primary rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Applying to GBP…" : label}
      </button>
      {result && <p className="mt-2 text-sm text-emerald-400">✓ {result}</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function applyLabel(action: GbpPlanActionType, step: GbpPlanStep): string {
  switch (action) {
    case "update_primary_category":
      return `Apply primary category: ${step.actionData?.primaryCategory ?? step.recommended ?? "Update"}`;
    case "add_secondary_categories":
      return "Apply secondary categories to GBP";
    case "update_description":
      return "Apply description to GBP";
    case "create_post":
      return "Publish Google Post to GBP";
    default:
      return "Apply to GBP";
  }
}

function buildPayload(action: GbpPlanActionType, step: GbpPlanStep) {
  const data = step.actionData ?? {};
  switch (action) {
    case "update_primary_category":
      return {
        primaryCategory: data.primaryCategory ?? step.recommended,
      };
    case "add_secondary_categories":
      return {
        secondaryCategories:
          data.secondaryCategories ??
          step.bullets?.filter((b) => !b.toLowerCase().includes("primary")) ??
          [],
      };
    case "update_description":
      return {
        description:
          data.description ??
          step.copyBlocks?.find((b) => b.label.toLowerCase().includes("description"))?.content,
      };
    case "create_post":
      return {
        postSummary: data.postSummary ?? step.copyBlocks?.[0]?.content,
      };
    default:
      return {};
  }
}

function CadenceCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-slate-300">
            <span className="text-emerald-400">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
