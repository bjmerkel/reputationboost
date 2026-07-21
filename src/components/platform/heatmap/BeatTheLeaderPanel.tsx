"use client";

import type { LeaderDelta } from "@/audit/autopilot/types";
import {
  formatCellDirection,
  summarizeLeaderGaps,
} from "@/audit/autopilot/leader-delta-engine";

export default function BeatTheLeaderPanel({ delta }: { delta: LeaderDelta }) {
  const gaps = summarizeLeaderGaps(delta, 4);
  const topAction = delta.rankedActions[0];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#d2e3fc] bg-[#e8f0fe] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1a73e8]">
          Beat the leader
        </p>
        <p className="mt-1 text-xs text-[#3c4043]">
          <span className="font-semibold text-[#202124]">{delta.leaderName}</span> ranks #1 from{" "}
          {formatCellDirection(delta.gridNorth, delta.gridEast)} — you&apos;re{" "}
          {delta.clientRank == null
            ? "not visible in the top 20"
            : `#${delta.clientRank}`}
          .
        </p>
      </div>

      {gaps.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
            Exact gaps
          </p>
          <ul className="space-y-1.5">
            {gaps.map((line) => (
              <li
                key={line}
                className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] px-2.5 py-2 text-xs text-[#3c4043]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {topAction && (
        <div className="rounded-lg border border-[#e6f4ea] bg-[#f6fff8] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#137333]">
            Recommended next move
          </p>
          <p className="mt-1 text-xs text-[#3c4043]">{topAction.hypothesis}</p>
        </div>
      )}
    </div>
  );
}
