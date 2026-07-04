"use client";

import { usePreviewAudit } from "@/context/PreviewAuditContext";
import {
  PACK_LEADER_SCORE_BENCHMARK,
  SCORE_BANDS,
  scoreBandFor,
} from "@/lib/marketing/score-grades";

function Stars({ count, active }: { count: number; active: boolean }) {
  return (
    <span className="inline-flex text-[#fbbc04]" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < count ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
      {active && <span className="sr-only">{count} stars</span>}
    </span>
  );
}

export default function ScoreContextPanel() {
  const { preview, isLive, loading } = usePreviewAudit();

  if (loading || !isLive || !preview) {
    return null;
  }

  const score = preview.score.overall;
  const band = scoreBandFor(score);
  const gap = PACK_LEADER_SCORE_BENCHMARK - score;

  return (
    <div className="border-b border-[#dadce0] bg-white px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
              Your Reputation Boost Score
            </p>
            <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:items-end sm:justify-center lg:justify-start">
              <p
                className="text-6xl font-semibold leading-none sm:text-7xl"
                style={{ color: band.color }}
              >
                {score}
              </p>
              <p className="pb-2 text-2xl font-medium text-[#80868b]">/ 100</p>
            </div>
            <p className="mt-2 text-sm font-medium" style={{ color: band.color }}>
              {band.label} · {band.range}
            </p>

            <div className="mt-6 rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[#80868b]">
                Businesses in the Local 3-Pack nearby often score
              </p>
              <p className="mt-1 text-3xl font-semibold text-[#202124]">
                {PACK_LEADER_SCORE_BENCHMARK}
                <span className="text-lg font-normal text-[#80868b]"> / 100</span>
              </p>
              {gap > 0 && (
                <p className="mt-2 text-sm text-[#d93025]">
                  You&apos;re {gap} points behind the businesses getting most of the map clicks.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-5">
            <p className="text-sm font-semibold text-[#202124]">What your score means</p>
            <ul className="mt-4 space-y-3">
              {SCORE_BANDS.map((item) => {
                const isActive = item.id === band.id;
                return (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${
                      isActive ? "border border-[#dadce0] bg-white shadow-sm" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Stars count={item.stars} active={isActive} />
                      <span className={isActive ? "font-semibold text-[#202124]" : "text-[#5f6368]"}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[#80868b]">{item.range}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
