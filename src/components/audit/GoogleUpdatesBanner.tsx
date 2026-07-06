"use client";

import type { FullAuditPayload } from "@/audit/types";
import {
  getGoogleDiffFields,
  getGooglePendingFields,
  hasUnresolvedGoogleDiffs,
} from "@/lib/google/gbp-update-helpers";

function formatWhen(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function GoogleUpdatesBanner({
  audit,
  gbpGoogleUpdateAt,
  onOpenPlan,
  variant = "light",
}: {
  audit: FullAuditPayload;
  gbpGoogleUpdateAt?: string | null;
  onOpenPlan?: () => void;
  variant?: "light" | "dark";
}) {
  const diffFields = getGoogleDiffFields(audit);
  const pendingFields = getGooglePendingFields(audit);
  const hasDiff = diffFields.length > 0;
  const hasPending = pendingFields.length > 0;
  const alertTime = formatWhen(gbpGoogleUpdateAt);

  if (!hasDiff && !hasPending && !gbpGoogleUpdateAt) return null;

  const isLight = variant === "light";

  if (hasDiff) {
    const labels = diffFields.map((field) => field.label).join(", ");
    return (
      <div
        className={`mb-3 shrink-0 rounded-lg border px-4 py-3 ${
          isLight ? "border-[#feefc3] bg-[#fef7e0]" : "border-amber-500/25 bg-amber-500/5"
        }`}
      >
        <p className={`text-sm font-medium ${isLight ? "text-[#b06000]" : "text-amber-200"}`}>
          Google suggested profile changes
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Review conflicts for {labels}. Accept Google&apos;s version or keep yours in Plan.
          {alertTime ? ` Last Google alert: ${alertTime}.` : ""}
        </p>
        {onOpenPlan && (
          <button
            type="button"
            onClick={onOpenPlan}
            className={`mt-3 text-sm font-semibold hover:underline ${
              isLight ? "text-[#1a73e8]" : "text-emerald-400"
            }`}
          >
            Review Google updates
          </button>
        )}
      </div>
    );
  }

  if (hasPending) {
    const labels = pendingFields.map((field) => field.label).join(", ");
    return (
      <div
        className={`mb-3 shrink-0 rounded-lg border px-4 py-3 ${
          isLight ? "border-[#ceead6] bg-[#e6f4ea]" : "border-emerald-500/20 bg-emerald-500/5"
        }`}
      >
        <p className={`text-sm font-medium ${isLight ? "text-[#137333]" : "text-emerald-200"}`}>
          Google is processing your profile updates
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          {labels} {pendingFields.length === 1 ? "is" : "are"} still processing on Google. No action
          needed — this can take a few hours.
          {alertTime ? ` Last Google alert: ${alertTime}.` : ""}
        </p>
      </div>
    );
  }

  if (gbpGoogleUpdateAt && hasUnresolvedGoogleDiffs(audit) === false) {
    return (
      <div
        className={`mb-3 shrink-0 rounded-lg border px-4 py-3 ${
          isLight ? "border-[#dadce0] bg-[#f8f9fa]" : "border-slate-500/20 bg-slate-500/5"
        }`}
      >
        <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Google sent a profile update alert at {alertTime}. Refresh your plan if anything looks out of
          date.
        </p>
      </div>
    );
  }

  return null;
}
