"use client";

import EngagementTrendChart from "@/components/attribution/EngagementTrendChart";
import ScoreTrendChart from "@/components/attribution/ScoreTrendChart";

export default function ProfilePerformanceTrends({
  clientId,
  days = 14,
  variant = "light",
}: {
  clientId: string;
  days?: number;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="mb-3">
        <h3 className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          Performance trends
        </h3>
        <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Daily customer actions and Reputation Boost Score from stored metrics.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className={`mb-2 text-xs font-medium ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
            Customer actions
          </p>
          <EngagementTrendChart clientId={clientId} days={days} />
        </div>
        <div>
          <p className={`mb-2 text-xs font-medium ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
            Reputation Boost Score
          </p>
          <ScoreTrendChart clientId={clientId} days={days} compact />
        </div>
      </div>
    </div>
  );
}
