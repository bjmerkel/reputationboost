"use client";

import Link from "next/link";
import { trackPlanEvent } from "@/lib/analytics/plan-events";
import { profileGuideEditorHref } from "@/lib/profile-guide/readiness";

export default function PlanProfileGuideStepPanel({
  businessId,
  published,
  variant = "light",
}: {
  businessId?: string | null;
  published: boolean;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const href = profileGuideEditorHref(businessId, { from: "plan", focus: "publish" });

  if (published) {
    return (
      <div
        className={`rounded-lg border px-4 py-3 ${
          isLight ? "border-[#ceead6] bg-[#f6faf7]" : "border-emerald-400/20 bg-emerald-400/10"
        }`}
      >
        <p className={`text-sm font-semibold ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
          Profile Guide is live
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Review requests now use your branded guide link. Share your QR code to capture in-person
          reviews you can attribute.
        </p>
        <Link
          href={profileGuideEditorHref(businessId, { from: "plan" })}
          className={`mt-2 inline-flex text-sm font-semibold ${
            isLight ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
          }`}
        >
          View Profile Guide →
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        isLight ? "border-[#d2e3fc] bg-[#f8fbff]" : "border-sky-400/20 bg-sky-400/10"
      }`}
    >
      <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
        Set up your Profile Guide first
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Publish a branded page with your logo, a one-tap Review button, and a downloadable QR code.
        Step 10 review requests work best once this is live.
      </p>
      <Link
        href={href}
        onClick={() =>
          trackPlanEvent({
            name: "plan_profile_guide_cta_click",
            businessId,
            stepNumber: 16,
            meta: { source: "plan_step_card" },
          })
        }
        className={`mt-3 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
          isLight
            ? "bg-[#1a73e8] text-white hover:bg-[#1765cc]"
            : "bg-sky-500 text-white hover:bg-sky-400"
        }`}
      >
        Publish Profile Guide
      </Link>
    </div>
  );
}
