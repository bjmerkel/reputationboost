"use client";

import Link from "next/link";
import { formatCurrency } from "@/audit/attribution/roi";
import type { AcvRevenuePreview } from "./plan-viewport";

export default function PlanAcvNudge({
  variant = "light",
  revenuePreview = null,
  currency = "USD",
}: {
  variant?: "light" | "dark";
  revenuePreview?: AcvRevenuePreview | null;
  currency?: string;
}) {
  const isLight = variant === "light";

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        isLight
          ? "border-[#dadce0] bg-[#f8f9fa] text-[#3c4043]"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      <p className={`font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
        Add your average job value to turn leads into $/mo
      </p>
      {revenuePreview?.projectedMonthlyRevenue != null && revenuePreview.projectedMonthlyRevenue > 0 ? (
        <p className={`mt-1 text-xs ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
          At {formatCurrency(revenuePreview.defaultAcv, currency)} per customer, your top 3 actions
          could drive about{" "}
          <span className="font-semibold">
            {formatCurrency(revenuePreview.projectedMonthlyRevenue, currency)}/mo
          </span>
          {revenuePreview.leadGain != null ? ` (+${revenuePreview.leadGain} leads/mo)` : ""}.
        </p>
      ) : (
        <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Steps already show estimated leads/mo. Set average customer value to convert those into
          dollar estimates.
        </p>
      )}
      <Link
        href="/platform/settings"
        className={`mt-2 inline-flex text-xs font-semibold ${
          isLight ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
        }`}
      >
        Set average job value in Settings →
      </Link>
    </div>
  );
}
