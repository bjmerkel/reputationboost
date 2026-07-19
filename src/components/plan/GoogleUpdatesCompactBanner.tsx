"use client";

import { planScrollElementId } from "@/lib/google/gbp-field-plan-links";
import { GOOGLE_UPDATES_STEP_NUMBER } from "@/lib/google/gbp-update-helpers";

export default function GoogleUpdatesCompactBanner({
  pendingCount,
  variant = "light",
  onRefresh,
  syncing = false,
}: {
  pendingCount: number;
  variant?: "light" | "dark";
  onRefresh?: () => void;
  syncing?: boolean;
}) {
  if (pendingCount <= 0) return null;

  const isLight = variant === "light";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
        isLight
          ? "border-[#ceead6] bg-[#e6f4ea] text-[#137333]"
          : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
      }`}
    >
      <p>
        Google is processing {pendingCount} profile update{pendingCount === 1 ? "" : "s"} — no action
        needed yet.
      </p>
      {onRefresh && (
        <button
          type="button"
          disabled={syncing}
          onClick={onRefresh}
          className={`shrink-0 text-xs font-semibold disabled:opacity-50 ${
            isLight ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
          }`}
        >
          {syncing ? "Refreshing…" : "Refresh from Google"}
        </button>
      )}
    </div>
  );
}

export function GoogleUpdatesConflictLink({
  conflictCount,
  diffCount,
  variant = "light",
}: {
  conflictCount: number;
  diffCount: number;
  variant?: "light" | "dark";
}) {
  const total = conflictCount > 0 ? conflictCount : diffCount;
  if (total <= 0) return null;

  const isLight = variant === "light";
  const label =
    conflictCount > 0
      ? `${conflictCount} Google conflict${conflictCount === 1 ? "" : "s"} need your decision`
      : `${diffCount} Google update${diffCount === 1 ? "" : "s"} need your decision`;

  return (
    <button
      type="button"
      onClick={() => {
        document
          .getElementById(planScrollElementId(GOOGLE_UPDATES_STEP_NUMBER))
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={`text-left text-sm font-semibold ${
        isLight ? "text-[#b06000] hover:text-[#8a4c00]" : "text-amber-200 hover:text-amber-100"
      }`}
    >
      {label} — review in plan step 0 →
    </button>
  );
}
