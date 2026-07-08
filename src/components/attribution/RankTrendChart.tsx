"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, MultiLineChart } from "@/components/attribution/MiniChart";
import { SEARCH_RADII_MILES } from "@/lib/google/places";

type RankTrendPoint = {
  date: string;
  rank: number | null;
  distanceMiles: number;
};

type RadiusView = "all" | 1 | 3 | 5 | 10;

const RADIUS_OPTIONS: Array<{ id: RadiusView; label: string }> = [
  { id: "all", label: "All radii" },
  { id: 1, label: "1 mi" },
  { id: 3, label: "3 mi" },
  { id: 5, label: "5 mi" },
  { id: 10, label: "10 mi" },
];

export default function RankTrendChart({
  clientId,
  keyword,
  days = 90,
}: {
  clientId: string;
  keyword: string;
  days?: number;
}) {
  const [series, setSeries] = useState<RankTrendPoint[]>([]);
  const [multiRadius, setMultiRadius] = useState(true);
  const [radiusView, setRadiusView] = useState<RadiusView>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const params = new URLSearchParams({
          clientId,
          keyword,
          days: String(days),
          multiRadius: radiusView === "all" ? "true" : "false",
        });
        if (radiusView !== "all") {
          params.set("radiusMiles", String(radiusView));
        }

        const res = await fetch(`/api/metrics/ranks?${params.toString()}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setSeries(data.series ?? []);
          setMultiRadius(Boolean(data.multiRadius));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, keyword, days, radiusView]);

  const chart = useMemo(() => {
    const dates = [...new Set(series.map((p) => p.date))].sort();
    const labels = dates.map((date) =>
      new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    );

    if (radiusView === "all" && multiRadius) {
      const byRadius = new Map<number, Map<string, number | null>>();
      for (const miles of SEARCH_RADII_MILES) {
        byRadius.set(miles, new Map());
      }
      for (const point of series) {
        byRadius.get(point.distanceMiles)?.set(point.date, point.rank);
      }

      const multiSeries = SEARCH_RADII_MILES.map((miles) => ({
        name: `${miles} mi`,
        distanceMiles: miles,
        values: dates.map((date) => byRadius.get(miles)?.get(date) ?? null),
      })).filter((s) => s.values.some((v) => v != null));

      return { mode: "multi" as const, labels, multiSeries };
    }

    const values = dates.map((date) => {
      const point = series.find((p) => p.date === date);
      return point?.rank ?? null;
    });

    return { mode: "single" as const, labels, values, radius: radiusView === "all" ? 1 : radiusView };
  }, [series, radiusView, multiRadius]);

  if (loading) {
    return <p className="text-sm text-[#5f6368]">Loading rank trend…</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#5f6368]">
          Lower is better · {keyword}
        </p>
        <div className="flex flex-wrap gap-1">
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => setRadiusView(opt.id)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                radiusView === opt.id
                  ? "bg-[#e8f0fe] text-[#1a73e8]"
                  : "bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {chart.mode === "multi" ? (
        <MultiLineChart labels={chart.labels} series={chart.multiSeries} />
      ) : (
        <LineChart
          labels={chart.labels}
          values={chart.values}
          stroke="#188038"
          fill="rgba(24, 128, 56, 0.08)"
        />
      )}
    </div>
  );
}
