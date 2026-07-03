"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/attribution/MiniChart";

export default function RankTrendChart({
  clientId,
  keyword,
  days = 90,
}: {
  clientId: string;
  keyword: string;
  days?: number;
}) {
  const [series, setSeries] = useState<Array<{ date: string; rank: number | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const res = await fetch(
          `/api/metrics/ranks?clientId=${encodeURIComponent(clientId)}&keyword=${encodeURIComponent(keyword)}&days=${days}`
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
    return <p className="text-sm text-[#5f6368]">Loading rank trend…</p>;
  }

  const labels = series.map((p) =>
    new Date(`${p.date}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  );
  const values = series.map((p) => p.rank);

  return (
    <div>
      <p className="mb-2 text-xs text-[#5f6368]">
        Lower is better · 1-mile radius · {keyword}
      </p>
      <LineChart labels={labels} values={values} stroke="#188038" fill="rgba(24, 128, 56, 0.08)" />
    </div>
  );
}
