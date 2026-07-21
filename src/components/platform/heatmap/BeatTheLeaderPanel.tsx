"use client";

import { useState } from "react";
import type { LeaderDelta } from "@/audit/autopilot/types";
import {
  formatCellDirection,
  summarizeLeaderGaps,
} from "@/audit/autopilot/leader-delta-engine";

export default function BeatTheLeaderPanel({
  delta,
  clientId,
  onExperimentCreated,
}: {
  delta: LeaderDelta;
  clientId?: string;
  onExperimentCreated?: () => void;
}) {
  const gaps = summarizeLeaderGaps(delta, 4);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedAction = delta.rankedActions[selectedIndex] ?? delta.rankedActions[0];
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExperiment() {
    if (!clientId || !selectedAction) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/autopilot/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          keyword: delta.keyword,
          gridNorth: delta.gridNorth,
          gridEast: delta.gridEast,
          actionIndex: selectedIndex,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create experiment");
        return;
      }
      setMessage("Experiment queued for approval in Plan.");
      onExperimentCreated?.();
    } catch {
      setError("Could not create experiment");
    } finally {
      setSubmitting(false);
    }
  }

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

      {delta.rankedActions.length > 0 && (
        <div className="rounded-lg border border-[#e6f4ea] bg-[#f6fff8] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#137333]">
            Recommended actions
          </p>
          {delta.rankedActions.length > 1 && (
            <ul className="mt-2 space-y-1.5">
              {delta.rankedActions.slice(0, 4).map((action, index) => (
                <li key={`${action.actionType}-${index}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(index)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      selectedIndex === index
                        ? "border-[#1a73e8] bg-[#e8f0fe] text-[#202124]"
                        : "border-[#e8eaed] bg-white text-[#5f6368]"
                    }`}
                  >
                    <span className="font-semibold">#{index + 1}</span> {action.hypothesis}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {delta.rankedActions.length === 1 && selectedAction && (
            <p className="mt-1 text-xs text-[#3c4043]">{selectedAction.hypothesis}</p>
          )}
          {clientId && selectedAction && (
            <button
              type="button"
              onClick={() => void runExperiment()}
              disabled={submitting || Boolean(message)}
              className="mt-2 rounded-full bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {submitting
                ? "Creating…"
                : message
                  ? "Queued for approval"
                  : "Run experiment"}
            </button>
          )}
          {error && <p className="mt-2 text-xs text-[#c5221f]">{error}</p>}
          {message && <p className="mt-2 text-xs text-[#137333]">{message}</p>}
        </div>
      )}
    </div>
  );
}
