"use client";

import { LineChart } from "@/components/attribution/MiniChart";

export default function PlatformScoreChart({
  points,
}: {
  points: Array<{ date: string; avgOverall: number }>;
}) {
  if (points.length < 2) {
    return <p className="text-sm text-[#64748b]">Not enough score history yet.</p>;
  }

  const labels = points.map((point) => {
    const date = new Date(`${point.date}T00:00:00Z`);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const values = points.map((point) => point.avgOverall);

  return (
    <div className="rounded-lg border border-[#2d3348] bg-[#1a1f2e] p-4">
      <LineChart labels={labels} values={values} width={640} height={160} stroke="#818cf8" fill="rgba(129, 140, 248, 0.1)" nullRank={50} />
    </div>
  );
}
