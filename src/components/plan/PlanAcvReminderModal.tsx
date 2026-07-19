"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/audit/attribution/roi";
import { formatLeadGainSuffix } from "@/audit/phase3/plan-impact-label";
import { markPlanRefreshAfterAcvSave } from "@/components/results/results-focus";
import type { AcvEstimateResult } from "@/lib/llm/acv-estimate";
import type { AcvCopy } from "@/lib/business/acv-copy";
import type { AcvRevenuePreview } from "./plan-viewport";
import {
  dismissPlanAcvReminderForSession,
  snoozePlanAcvReminder,
} from "./plan-acv-reminder";

export default function PlanAcvReminderModal({
  open,
  businessId,
  currency = "USD",
  estimate,
  estimateLoading = false,
  revenuePreview = null,
  acvCopy,
  onClose,
  onSaved,
}: {
  open: boolean;
  businessId: string;
  currency?: string;
  estimate: AcvEstimateResult | null;
  estimateLoading?: boolean;
  revenuePreview?: AcvRevenuePreview | null;
  acvCopy: AcvCopy;
  onClose: () => void;
  onSaved?: (value: number) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (estimate?.avgCustomerValue) {
      setValue(String(estimate.avgCustomerValue));
    }
    setError(null);
  }, [estimate?.avgCustomerValue, open]);

  if (!open) return null;

  async function handleSave() {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid dollar amount.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, avgCustomerValue: parsed }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      markPlanRefreshAfterAcvSave();
      onSaved?.(parsed);
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleRemindLater() {
    snoozePlanAcvReminder(businessId);
    dismissPlanAcvReminderForSession(businessId);
    onClose();
  }

  function handleClose() {
    dismissPlanAcvReminderForSession(businessId);
    onClose();
  }

  const previewAcv = estimate?.avgCustomerValue ?? revenuePreview?.defaultAcv ?? null;
  const projectedRevenue =
    previewAcv && revenuePreview?.projectedMonthlyLeads != null
      ? Math.round(previewAcv * revenuePreview.projectedMonthlyLeads)
      : revenuePreview?.projectedMonthlyRevenue ?? null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-acv-reminder-title"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="plan-acv-reminder-title" className="text-lg font-bold text-[#202124]">
            {acvCopy.planNudgeTitle}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm text-[#5f6368]">
          Plan steps already show estimated leads per month. Set your typical {acvCopy.shortLabel} so
          we can rank actions by revenue impact.
        </p>

        {estimateLoading ? (
          <p className="mt-4 text-sm text-[#5f6368]">Estimating a typical value for your market…</p>
        ) : estimate ? (
          <div className="mt-4 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2.5 text-sm text-[#3c4043]">
            <p className="font-medium text-[#202124]">
              Suggested: {formatCurrency(estimate.avgCustomerValue, currency)}
              {estimate.source === "llm" ? " (AI estimate)" : " (category default)"}
            </p>
            <p className="mt-1 text-xs text-[#5f6368]">{estimate.rationale}</p>
          </div>
        ) : null}

        {projectedRevenue != null && projectedRevenue > 0 && previewAcv != null ? (
          <p className="mt-3 text-sm text-[#137333]">
            At {formatCurrency(previewAcv, currency)} {acvCopy.perUnit}, your top actions could drive
            about{" "}
            <span className="font-semibold">{formatCurrency(projectedRevenue, currency)}/mo</span>
            {formatLeadGainSuffix(revenuePreview?.leadGain)}.
          </p>
        ) : null}

        <label className="mt-4 block">
          <span className="text-sm font-medium text-[#3c4043]">{acvCopy.fieldLabel}</span>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 350"
              className="w-full rounded-lg border border-[#dadce0] py-2.5 pl-7 pr-3 text-sm text-[#202124] outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
            />
          </div>
        </label>

        {error && <p className="mt-2 text-sm text-[#d93025]">{error}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || estimateLoading}
            className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save and update plan"}
          </button>
          <button
            type="button"
            onClick={handleRemindLater}
            className="rounded-full border border-[#dadce0] px-5 py-2.5 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
          >
            Remind me in 7 days
          </button>
        </div>

        <Link
          href="/platform/settings"
          onClick={handleClose}
          className="mt-3 inline-flex text-xs font-semibold text-[#1a73e8] hover:underline"
        >
          Open full ROI settings →
        </Link>
      </div>
    </div>
  );
}
