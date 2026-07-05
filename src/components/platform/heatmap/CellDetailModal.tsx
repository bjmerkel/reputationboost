"use client";

import { useEffect } from "react";
import type { GeoGridPoint } from "@/audit/types";
import { rankColor } from "@/components/platform/heatmap/rank-colors";

export default function CellDetailModal({
  cell,
  keyword,
  clientRating,
  clientReviewCount,
  open,
  onClose,
}: {
  cell: GeoGridPoint | null;
  keyword: string;
  clientRating?: number;
  clientReviewCount?: number;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !cell) return null;

  const direction =
    cell.offsetNorthMiles === 0 && cell.offsetEastMiles === 0
      ? "your location"
      : `${Math.abs(cell.offsetNorthMiles).toFixed(1)} mi ${cell.offsetNorthMiles >= 0 ? "N" : "S"} · ${Math.abs(cell.offsetEastMiles).toFixed(1)} mi ${cell.offsetEastMiles >= 0 ? "E" : "W"}`;

  const leader = cell.localPack?.[0];
  const reviewGap =
    leader && clientReviewCount != null
      ? Math.max(0, leader.reviewCount - clientReviewCount)
      : null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-end justify-center bg-black/20 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[#dadce0] bg-white shadow-[0_8px_24px_rgba(60,64,67,0.2)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cell-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e8eaed] px-4 py-3">
          <div>
            <p id="cell-detail-title" className="text-sm font-semibold text-[#202124]">
              Who ranks here?
            </p>
            <p className="mt-0.5 text-xs text-[#5f6368]">
              Searched from {direction}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 px-4 py-3">
          <p className="text-xs text-[#5f6368]">
            Keyword: <span className="font-medium text-[#202124]">&ldquo;{keyword}&rdquo;</span>
          </p>

          <div className="rounded-lg bg-[#f8f9fa] px-3 py-2">
            <p className="text-xs text-[#80868b]">Your rank from this area</p>
            <p className="text-lg font-semibold" style={{ color: rankColor(cell.rank) }}>
              {cell.rank == null ? "Not found" : cell.rank <= 3 ? `#${cell.rank} in Local 3-Pack` : `#${cell.rank}`}
            </p>
          </div>

          {cell.localPack && cell.localPack.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#80868b]">
                Local 3-Pack from here
              </p>
              <ul className="space-y-2">
                {cell.localPack.map((entry) => (
                  <li
                    key={`${entry.placeId}-${entry.position}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#e8eaed] px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-[#202124]">
                      #{entry.position} {entry.name}
                    </span>
                    <span className="text-[#5f6368]">
                      {entry.rating != null ? `${entry.rating}★` : "—"} · {entry.reviewCount} reviews
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-[#5f6368]">No local pack data for this cell.</p>
          )}

          {leader && reviewGap != null && reviewGap > 0 && (
            <p className="rounded-lg border border-[#fce8e6] bg-[#fef7f0] px-3 py-2 text-xs text-[#c5221f]">
              <span className="font-medium">{leader.name}</span> leads here with {reviewGap} more
              reviews than you
              {clientReviewCount != null ? ` (${leader.reviewCount} vs ${clientReviewCount})` : ""}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
