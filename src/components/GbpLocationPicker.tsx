"use client";

import type { RankedGbpLocation } from "@/lib/google/gbp-onboarding-match";

interface GbpLocationPickerProps {
  locations: RankedGbpLocation[];
  loading?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  onSelect: (location: RankedGbpLocation) => void;
  theme?: "light" | "dark";
}

export default function GbpLocationPicker({
  locations,
  loading = false,
  disabled = false,
  emptyMessage = "No available locations found for this Google account.",
  onSelect,
  theme = "dark",
}: GbpLocationPickerProps) {
  const isLight = theme === "light";

  if (loading) {
    return (
      <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Loading Google listings…
      </p>
    );
  }

  if (locations.length === 0) {
    return (
      <p className={`rounded-lg border px-4 py-3 text-sm ${
        isLight
          ? "border-[#dadce0] bg-[#f8f9fa] text-[#5f6368]"
          : "border-white/10 bg-white/[0.03] text-slate-400"
      }`}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {locations.map((loc) => (
        <button
          key={`${loc.accountId}-${loc.locationId}`}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(loc)}
          className={`w-full rounded-xl border p-4 text-left transition disabled:opacity-50 ${
            loc.recommended
              ? isLight
                ? "border-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc]"
                : "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/15"
              : isLight
                ? "border-[#dadce0] bg-white hover:border-[#1a73e8] hover:bg-[#f8f9fa]"
                : "border-white/10 bg-white/[0.03] hover:border-emerald-500/40 hover:bg-white/[0.05]"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className={`font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
              {loc.title}
            </p>
            {loc.recommended && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  isLight ? "bg-[#1a73e8] text-white" : "bg-emerald-500 text-white"
                }`}
              >
                Recommended
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            {loc.address}
          </p>
          <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {loc.primaryCategory}
            {loc.chainDisplayName ? ` · ${loc.chainDisplayName} chain` : ""}
            {loc.matchReason ? ` · ${loc.matchReason}` : ""}
          </p>
        </button>
      ))}
    </div>
  );
}
