"use client";

import { useEffect, useMemo, useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
import type { DailyMetricPoint } from "@/audit/types/timeseries";
import { performancePointsWithAuditFallback } from "@/lib/metrics/trend-fallbacks";
import { BarChart } from "@/components/attribution/MiniChart";

function aggregateByDate(
  points: DailyMetricPoint[],
  metrics: DailyMetricPoint["metric"][]
): { labels: string[]; values: number[] } {
  const byDate = new Map<string, number>();

  for (const point of points) {
    if (!metrics.includes(point.metric)) continue;
    byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.value);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  return {
    labels: sorted.map(([date]) =>
      new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    ),
    values: sorted.map(([, value]) => value),
  };
}

export default function EngagementTrendChart({
  clientId,
  days = 30,
  points: pointsProp,
  loading: loadingProp,
  audit,
}: {
  clientId: string;
  days?: number;
  points?: DailyMetricPoint[];
  loading?: boolean;
  audit?: FullAuditPayload | null;
}) {
  const [fetchedPoints, setFetchedPoints] = useState<DailyMetricPoint[]>([]);
  const [fetchLoading, setFetchLoading] = useState(pointsProp === undefined);

  useEffect(() => {
    if (pointsProp !== undefined) return;

    let cancelled = false;
    setFetchLoading(true);

    async function load() {
      try {
        const res = await fetch(
          `/api/metrics/performance?clientId=${encodeURIComponent(clientId)}&days=${days}`
        );
        const data = await res.json();
        if (!cancelled && res.ok) {
          setFetchedPoints(data.series ?? []);
        }
      } finally {
        if (!cancelled) setFetchLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, days, pointsProp]);

  const points = useMemo(
    () => performancePointsWithAuditFallback(pointsProp ?? fetchedPoints, audit),
    [audit, fetchedPoints, pointsProp]
  );

  const loading = loadingProp ?? fetchLoading;
  const usingAuditFallback = (pointsProp ?? fetchedPoints).length > 0 && sumActions(pointsProp ?? fetchedPoints) === 0 && sumActions(points) > 0;

  const chartData = useMemo(() => {
    const dates = [...new Set(points.map((p) => p.date))].sort();
    const labels = dates.map((date) =>
      new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );

    const metricSeries = [
      { name: "Calls", metric: "calls" as const, color: "#188038" },
      { name: "Directions", metric: "direction_requests" as const, color: "#1a73e8" },
      { name: "Clicks", metric: "website_clicks" as const, color: "#9334e6" },
    ];

    return {
      labels,
      series: metricSeries.map((s) => ({
        name: s.name,
        color: s.color,
        values: dates.map((date) => {
          const point = points.find((p) => p.date === date && p.metric === s.metric);
          return point?.value ?? 0;
        }),
      })),
    };
  }, [points]);

  const totals = useMemo(
    () => aggregateByDate(points, ["calls", "direction_requests", "website_clicks"]),
    [points]
  );

  const totalActions = totals.values.reduce((a, b) => a + b, 0);

  if (loading) {
    return <p className="text-sm text-[#5f6368]">Loading engagement trend…</p>;
  }

  if (points.length === 0) {
    return (
      <p className="text-sm text-[#5f6368]">
        Daily engagement data will appear after the ingest cron runs or you backfill history.
      </p>
    );
  }

  if (totalActions === 0) {
    return (
      <p className="text-sm text-[#5f6368]">
        No customer actions recorded in the last {days} days. Profile views and rankings still update nightly.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <BarChart labels={chartData.labels} series={chartData.series} />
      <p className="text-xs text-[#80868b]">
        {totalActions} total customer actions in the last {days} days
        {usingAuditFallback ? " · showing latest audit period totals" : ""}
      </p>
    </div>
  );
}

function sumActions(points: DailyMetricPoint[]): number {
  return points
    .filter((point) =>
      ["calls", "direction_requests", "website_clicks"].includes(point.metric)
    )
    .reduce((sum, point) => sum + point.value, 0);
}
