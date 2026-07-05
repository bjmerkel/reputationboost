"use client";

import { useEffect, useRef, useState } from "react";
import type { GridDiff } from "@/audit/geo/grid-diff";

interface SnapshotMeta {
  date: string;
  coveragePercent: number;
  source: string;
}

interface GridDiffControlsProps {
  clientId: string;
  keyword: string;
  enabled: boolean;
  onDiffChange: (diff: GridDiff | null, active: boolean) => void;
}

export default function GridDiffControls({
  clientId,
  keyword,
  enabled,
  onDiffChange,
}: GridDiffControlsProps) {
  const [active, setActive] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [beforeDate, setBeforeDate] = useState<string>("");
  const [afterDate, setAfterDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const onDiffChangeRef = useRef(onDiffChange);
  onDiffChangeRef.current = onDiffChange;

  useEffect(() => {
    if (!enabled || !keyword) return;

    let cancelled = false;

    async function loadSnapshots() {
      try {
        const res = await fetch(
          `/api/metrics/grid-snapshots?clientId=${encodeURIComponent(clientId)}&keyword=${encodeURIComponent(keyword)}&limit=12`
        );
        const data = await res.json();
        if (!cancelled && res.ok && data.snapshots?.length) {
          setSnapshots(data.snapshots);
          setAfterDate(data.snapshots[0]!.date);
          setBeforeDate(data.snapshots[1]?.date ?? data.snapshots[0]!.date);
        }
      } catch {
        // Grid history unavailable
      }
    }

    void loadSnapshots();
    return () => {
      cancelled = true;
    };
  }, [clientId, keyword, enabled]);

  useEffect(() => {
    if (!active || !beforeDate || !afterDate || beforeDate === afterDate) {
      onDiffChangeRef.current(null, false);
      setSummary(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function loadDiff() {
      try {
        const res = await fetch(
          `/api/metrics/grid-diff?clientId=${encodeURIComponent(clientId)}&keyword=${encodeURIComponent(keyword)}&before=${beforeDate}&after=${afterDate}`
        );
        const data = await res.json();
        if (!cancelled && res.ok && data.diff) {
          const d = data.diff as GridDiff;
          onDiffChangeRef.current(d, true);
          const sign = d.coverageDelta > 0 ? "+" : "";
          setSummary(
            `${sign}${d.coverageDelta} pts coverage · +${d.cellsImproved} improved · ${d.cellsRegressed} regressed`
          );
        } else if (!cancelled) {
          onDiffChangeRef.current(null, false);
          setSummary("Not enough snapshot data");
        }
      } catch {
        if (!cancelled) {
          onDiffChangeRef.current(null, false);
          setSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDiff();
    return () => {
      cancelled = true;
    };
  }, [active, beforeDate, afterDate, clientId, keyword]);

  if (!enabled || snapshots.length < 2) return null;

  function formatShort(date: string): string {
    return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="absolute top-[6.5rem] left-3 z-10 max-w-[min(300px,calc(100%-1.5rem))] rounded-lg border border-[#dadce0]/80 bg-white px-2.5 py-2 shadow-[0_2px_6px_rgba(60,64,67,0.15)] sm:top-[7rem]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
          Compare over time
        </p>
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
            active
              ? "bg-[#1a73e8] text-white"
              : "border border-[#dadce0] bg-[#f8f9fa] text-[#3c4043]"
          }`}
        >
          {active ? "On" : "Compare"}
        </button>
      </div>

      {active && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <select
              value={beforeDate}
              onChange={(e) => setBeforeDate(e.target.value)}
              className="min-w-0 flex-1 rounded border border-[#dadce0] bg-white px-1.5 py-1 text-[10px] text-[#202124]"
            >
              {snapshots.map((s) => (
                <option key={`before-${s.date}`} value={s.date}>
                  {formatShort(s.date)} ({s.coveragePercent}%)
                </option>
              ))}
            </select>
            <span className="text-[10px] text-[#80868b]">→</span>
            <select
              value={afterDate}
              onChange={(e) => setAfterDate(e.target.value)}
              className="min-w-0 flex-1 rounded border border-[#dadce0] bg-white px-1.5 py-1 text-[10px] text-[#202124]"
            >
              {snapshots.map((s) => (
                <option key={`after-${s.date}`} value={s.date}>
                  {formatShort(s.date)} ({s.coveragePercent}%)
                </option>
              ))}
            </select>
          </div>
          {loading && <p className="text-[10px] text-[#1a73e8]">Loading diff…</p>}
          {summary && !loading && (
            <p className="text-[10px] text-[#5f6368]">{summary}</p>
          )}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {[
              { label: "Improved", color: "#34a853" },
              { label: "Regressed", color: "#ea4335" },
              { label: "Same", color: "#fbbc04" },
            ].map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1 text-[9px] text-[#5f6368]"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
