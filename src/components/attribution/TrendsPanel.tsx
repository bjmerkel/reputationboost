"use client";

import RankTrendChart from "@/components/attribution/RankTrendChart";
import CoverageTrendChart from "@/components/attribution/CoverageTrendChart";
import EngagementTrendChart from "@/components/attribution/EngagementTrendChart";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";

export default function TrendsPanel({
  clientId,
  keywords,
  activeKeyword,
  onKeywordChange,
}: {
  clientId: string;
  keywords: string[];
  activeKeyword: string;
  onKeywordChange: (keyword: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#dadce0] bg-white p-5">
        <h4 className="text-sm font-semibold text-[#202124]">Engagement over time</h4>
        <p className="mt-1 text-xs text-[#5f6368]">Daily calls, directions, and website clicks</p>
        <div className="mt-4">
          <EngagementTrendChart clientId={clientId} days={30} />
        </div>
      </section>

      <section className="rounded-xl border border-[#dadce0] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[#202124]">Keyword rank trend</h4>
            <p className="mt-1 text-xs text-[#5f6368]">1-mile Local Pack position over time</p>
          </div>
          {keywords.length > 1 && (
            <select
              value={activeKeyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              className="rounded-lg border border-[#dadce0] bg-white px-3 py-1.5 text-sm text-[#202124]"
            >
              {keywords.map((kw) => (
                <option key={kw} value={kw}>
                  {kw}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-4">
          {activeKeyword ? (
            <RankTrendChart clientId={clientId} keyword={activeKeyword} days={90} />
          ) : (
            <p className="text-sm text-[#5f6368]">Add keywords to track rank trends.</p>
          )}
        </div>
      </section>

      {HEATMAP_FLAGS.gridDiff && (
        <section className="rounded-xl border border-[#dadce0] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-[#202124]">Grid coverage over time</h4>
              <p className="mt-1 text-xs text-[#5f6368]">
                Share of service area in Local 3-Pack (full geo-grid snapshots)
              </p>
            </div>
            {keywords.length > 1 && (
              <select
                value={activeKeyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                className="rounded-lg border border-[#dadce0] bg-white px-3 py-1.5 text-sm text-[#202124]"
              >
                {keywords.map((kw) => (
                  <option key={kw} value={kw}>
                    {kw}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4">
            {activeKeyword ? (
              <CoverageTrendChart clientId={clientId} keyword={activeKeyword} days={90} />
            ) : (
              <p className="text-sm text-[#5f6368]">Add keywords to track grid coverage.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
