"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackPlanEvent } from "@/lib/analytics/plan-events";
import { profileGuideEditorHref } from "@/lib/profile-guide/readiness";
import type { ProfileGuideReadiness } from "@/lib/profile-guide/readiness";

const STORAGE_KEY = "rb-plan-reputation-guide-dismissed";

const QUICK_START = [
  {
    title: "Publish your Profile Guide",
    body: "Set up a branded QR page so in-person customers can leave reviews with one tap.",
    focus: "publish" as const,
  },
  {
    title: "Send review requests",
    body: "Text recent customers a link to your Profile Guide — we track which scans become reviews.",
    focus: undefined,
  },
  {
    title: "Reply within 24 hours",
    body: "Respond to every review with keyword-aware replies that build trust and protect your score.",
    focus: undefined,
  },
] as const;

export default function PlanReputationGuidePanel({
  businessId,
  readiness,
  variant = "light",
}: {
  businessId?: string | null;
  readiness: ProfileGuideReadiness;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const [expanded, setExpanded] = useState(true);
  const [showQuickStart, setShowQuickStart] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
      setShowQuickStart(!dismissed);
      setExpanded(!dismissed);
    } catch {
      setShowQuickStart(true);
      setExpanded(true);
    }
  }, []);

  function dismissQuickStart() {
    setShowQuickStart(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures
    }
  }

  if (!showQuickStart && !expanded) {
    return null;
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        isLight ? "border-[#d2e3fc] bg-[#f8fbff]" : "border-sky-400/20 bg-sky-400/10"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={`flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left ${
          isLight ? "border-[#e8f0fe] hover:bg-[#eef4fd]" : "border-white/10 hover:bg-white/5"
        }`}
        aria-expanded={expanded}
      >
        <span className={`text-sm font-semibold ${isLight ? "text-[#1a73e8]" : "text-sky-300"}`}>
          Reputation in 3 steps
        </span>
        <span className={isLight ? "text-[#80868b]" : "text-slate-500"} aria-hidden>
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 px-4 py-4">
          {showQuickStart && (
            <div className="space-y-3">
              {QUICK_START.map((step, index) => {
                const href =
                  index === 0
                    ? profileGuideEditorHref(businessId, { from: "plan", focus: "publish" })
                    : null;

                return (
                  <div key={step.title} className="flex gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isLight ? "bg-[#e8f0fe] text-[#1a73e8]" : "bg-white/10 text-sky-300"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
                        {step.title}
                        {index === 0 && readiness.published && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isLight ? "bg-[#e6f4ea] text-[#137333]" : "bg-emerald-400/15 text-emerald-300"
                            }`}
                          >
                            Live
                          </span>
                        )}
                      </p>
                      <p className={`mt-0.5 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                        {step.body}
                      </p>
                      {href && !readiness.published && (
                        <Link
                          href={href}
                          onClick={() =>
                            trackPlanEvent({
                              name: "plan_profile_guide_cta_click",
                              businessId,
                              meta: { source: "reputation_quick_start" },
                            })
                          }
                          className={`mt-1 inline-flex text-xs font-semibold ${
                            isLight ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
                          }`}
                        >
                          Set up Profile Guide →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showQuickStart && (
            <button
              type="button"
              onClick={dismissQuickStart}
              className={`text-xs font-medium ${
                isLight ? "text-[#80868b] hover:text-[#5f6368]" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Got it, hide this
            </button>
          )}
        </div>
      )}
    </div>
  );
}
