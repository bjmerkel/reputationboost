"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/attribution/MiniChart";

export default function CoverageTrendChart({
  clientId,
  keyword,
  days = 90,
}: {
  clientId: string;
  keyword: string;
  days?: number;
}) {
  const [series, setSeries] = useState<Array<{ date: string; coveragePercent: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const res = await fetch(
          `/api/metrics/grid-coverage?clientId=${encodeURIComponent(clientId)}&keyword=${encodeURIComponent(keyword)}&days=${days}`
        );
        const data = await res.json();
        if (!cancelled && res.ok) {
          setSeries(data.series ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, keyword, days]);

  if (loading) {
    return <p className="text-sm text-[#5f6368]">Loading coverage trend…</p>;
  }

  if (series.length === 0) {
    return (
      <p className="text-sm text-[#5f6368]">
        Grid coverage history will appear after your next audit or weekly snapshot.
      </p>
    );
  }

  const labels = series.map((p) =>
    new Date(`${p.date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  );
  const values = series.map((p) => p.coveragePercent);

  return (
    <div>
      <LineChart labels={labels} values={values} stroke="#34a853" fill="rgba(52, 168, 83, 0.08)" nullRank={0} />
      <p className="mt-2 text-xs text-[#80868b]">
        Latest: {series[series.length - 1]!.coveragePercent}% pack coverage (
        {series[series.length - 1]!.date})
      </p>
    </div>
  );
}
