"use client";

import { useState } from "react";
import type { GbpOptimizationPlan } from "@/audit/types";

export default function GbpOptimizationPlanPanel({ plan }: { plan: GbpOptimizationPlan }) {
  const [expanded, setExpanded] = useState<number | null>(plan.steps[0]?.stepNumber ?? 1);

  return (
    <div className="space-y-6">
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
