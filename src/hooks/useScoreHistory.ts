"use client";

import { useEffect, useState } from "react";
import type { ScoreChangelogEntry } from "@/audit/types";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import type { ScoreDailySnapshot } from "@/audit/types/timeseries";

export interface ScoreHistoryData {
  series: ScoreDailySnapshot[];
  changelog: ScoreChangelogEntry[];
  latestDate: string | null;
  liveScores: {
    overall: number;
    visibility: number;
    conversion: number;
    revenueCapture: number;
    date: string;
  } | null;
  globalCalibration: AttributionCalibration;
}

export function useScoreHistory(clientId: string): {
  data: ScoreHistoryData;
  loading: boolean;
} {
  const [data, setData] = useState<ScoreHistoryData>({
    series: [],
    changelog: [],
    latestDate: null,
    liveScores: null,
    globalCalibration: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/metrics/score-history?clientId=${encodeURIComponent(clientId)}&days=30`
        );
        const json = await res.json();
        if (cancelled) return;

        if (res.ok) {
          setData({
            series: json.series ?? [],
            changelog: json.changelog ?? [],
            latestDate: json.latestDate ?? null,
            liveScores: json.liveScores ?? null,
            globalCalibration: json.globalCalibration ?? {},
          });
        }
      } catch {
        if (!cancelled) {
          setData({
            series: [],
            changelog: [],
            latestDate: null,
            liveScores: null,
            globalCalibration: {},
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { data, loading };
}
