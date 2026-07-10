"use client";

import { useEffect, useMemo, useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
import type { ScoreDailySnapshot } from "@/audit/types/timeseries";
import { scoreSeriesWithAuditFallback } from "@/lib/metrics/trend-fallbacks";
import { LineChart } from "@/components/attribution/MiniChart";

export default function ScoreTrendChart({
  clientId,
  days = 30,
  compact = false,
  series: seriesProp,
  loading: loadingProp,
  audit,
}: {
  clientId: string;
  days?: number;
  compact?: boolean;
  series?: ScoreDailySnapshot[];
  loading?: boolean;
  audit?: FullAuditPayload | null;
}) {
  const [fetchedSeries, setFetchedSeries] = useState<ScoreDailySnapshot[]>([]);
  const [fetchLoading, setFetchLoading] = useState(seriesProp === undefined);

  useEffect(() => {
    if (seriesProp !== undefined) return;

    let cancelled = false;
    setFetchLoading(true);

    async function load() {
      try {
        const res = await fetch(
          `/api/metrics/score-history?clientId=${encodeURIComponent(clientId)}&days=${days}`
        );
        const data = await res.json();
        if (!cancelled && res.ok) {
          setFetchedSeries(data.series ?? []);
        }
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, days, seriesProp]);

  const series = useMemo(
    () => scoreSeriesWithAuditFallback(seriesProp ?? fetchedSeries, audit),
    [audit, fetchedSeries, seriesProp]
  );

  const loading = loadingProp ?? fetchLoading;

  const chart = useMemo(() => {
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
    const labels = sorted.map((point) =>
      new Date(`${point.date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );
    const values = sorted.map((point) => point.overall);
    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];
    const delta =
      latest && earliest && sorted.length >= 2 ? latest.overall - earliest.overall : null;

    return { labels, values, latest, delta, sorted };
  }, [series]);

  if (loading) {
    return <p className="text-sm text-[#5f6368]">Loading score trend…</p>;
  }

  if (chart.sorted.length === 0) {
    return (
      <p className="text-sm text-[#5f6368]">
        Score history appears after nightly ingest runs or you complete a few audits.
      </p>
    );
  }

  if (chart.sorted.length === 1) {
    const point = chart.sorted[0]!;
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-[#e8eaed] bg-white px-4 py-3">
          <p className="text-2xl font-semibold text-[#202124]">{point.overall}</p>
          <p className="text-xs text-[#5f6368]">
            Score on {chart.labels[0]}
            {point.source === "audit" ? " · from your latest audit" : " · from nightly ingest"}
          </p>
        </div>
        <p className="text-xs text-[#80868b]">
          Trend line appears after scores are stored for at least two separate days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-xs text-[#5f6368]">Reputation Boost Score over time</p>
      )}
      <LineChart
        labels={chart.labels}
        values={chart.values}
        stroke="#1a73e8"
        fill="rgba(26, 115, 232, 0.08)"
        height={compact ? 88 : 120}
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#5f6368]">
        {chart.latest ? (
          <span>
            Latest:{" "}
            <span className="font-semibold text-[#202124]">{chart.latest.overall}</span>
          </span>
        ) : null}
        {chart.delta != null && (
          <span className={chart.delta >= 0 ? "text-[#137333]" : "text-[#c5221f]"}>
            {chart.delta >= 0 ? "+" : ""}
            {chart.delta} pts over {days}d
          </span>
        )}
      </div>
    </div>
  );
}
