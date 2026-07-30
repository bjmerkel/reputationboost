"use client";

import Link from "next/link";
import { trackPlanEvent } from "@/lib/analytics/plan-events";
import {
  PROFILE_GUIDE_STEP10_PREFLIGHT_BODY,
  PROFILE_GUIDE_STEP10_PREFLIGHT_CTA,
  PROFILE_GUIDE_STEP10_PREFLIGHT_TITLE,
} from "./plan-ux-copy";
import { profileGuideEditorHref } from "@/lib/profile-guide/readiness";

export default function PlanProfileGuidePreflight({
  businessId,
  variant = "light",
}: {
  businessId?: string | null;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const href = profileGuideEditorHref(businessId, { from: "plan", focus: "publish" });

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 ${
        isLight ? "border-[#fdd663] bg-[#fef7e0]" : "border-amber-400/30 bg-amber-400/10"
      }`}
    >
      <p className={`text-sm font-semibold ${isLight ? "text-[#3c4043]" : "text-amber-100"}`}>
        {PROFILE_GUIDE_STEP10_PREFLIGHT_TITLE}
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-amber-100/80"}`}>
        {PROFILE_GUIDE_STEP10_PREFLIGHT_BODY}
      </p>
      <Link
        href={href}
        onClick={() =>
          trackPlanEvent({
            name: "plan_profile_guide_cta_click",
            businessId,
            stepNumber: 10,
            meta: { source: "step10_preflight" },
          })
        }
        className={`mt-3 inline-flex text-sm font-semibold ${
          isLight ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
        }`}
      >
        {PROFILE_GUIDE_STEP10_PREFLIGHT_CTA} →
      </Link>
    </div>
  );
}
