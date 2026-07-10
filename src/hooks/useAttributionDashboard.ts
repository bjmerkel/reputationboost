"use client";

import { useEffect, useState } from "react";
import {
  buildEngagementPeriodSummary,
  type EngagementPeriodSummary,
} from "@/audit/engagement-period";
import type { FullAuditPayload } from "@/audit/types";
import type { ActionAttribution, AttributionSummary, PerformanceIngestMeta } from "@/audit/types/timeseries";
import type { DailyMetricPoint } from "@/audit/types/timeseries";

const ENGAGEMENT_PERIOD_DAYS = 30;
/** Fetch 2× period so we can compare current vs prior rolling windows. */
const PERFORMANCE_FETCH_DAYS = ENGAGEMENT_PERIOD_DAYS * 2;

export interface AttributionDashboardData {
  attributions: ActionAttribution[];
  summary: AttributionSummary | null;
  engagement: EngagementPeriodSummary | null;
  performanceSeries: DailyMetricPoint[];
  attributionByTaskId: Record<string, ActionAttribution>;
  sparklines: Record<string, number[]>;
}

export function useAttributionDashboard(
  clientId: string,
  audit: FullAuditPayload | null = null
): {
  data: AttributionDashboardData;
  loading: boolean;
} {
  const [data, setData] = useState<AttributionDashboardData>({
    attributions: [],
    summary: null,
    engagement: null,
    performanceSeries: [],
    attributionByTaskId: {},
    sparklines: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [attrRes, summaryRes, perfRes] = await Promise.all([
          fetch(`/api/attribution?clientId=${encodeURIComponent(clientId)}`),
          fetch(
            `/api/attribution/summary?clientId=${encodeURIComponent(clientId)}&period=${ENGAGEMENT_PERIOD_DAYS}d`
          ),
          fetch(
            `/api/metrics/performance?clientId=${encodeURIComponent(clientId)}&days=${PERFORMANCE_FETCH_DAYS}`
          ),
        ]);

        const [attrData, summaryData, perfData] = await Promise.all([
          attrRes.json(),
          summaryRes.json(),
          perfRes.json(),
        ]);

        if (cancelled) return;

        const attributions = (attrRes.ok ? attrData.attributions : []) as ActionAttribution[];
        const performanceSeries = (perfRes.ok ? perfData.series : []) as DailyMetricPoint[];
        const ingestMeta = (perfRes.ok ? perfData.ingestMeta : null) as PerformanceIngestMeta | null;

        const attributionByTaskId: Record<string, ActionAttribution> = {};
        for (const item of attributions) {
          attributionByTaskId[item.executionTaskId] = item;
        }

        const sparklines = buildSparklines(performanceSeries, ENGAGEMENT_PERIOD_DAYS);
        const engagement = buildEngagementPeriodSummary(
          performanceSeries,
          ENGAGEMENT_PERIOD_DAYS,
          { audit, ingestMeta }
        );

        setData({
          attributions,
          summary: summaryRes.ok ? summaryData.summary : null,
          engagement,
          performanceSeries,
          attributionByTaskId,
          sparklines,
        });
      } catch {
        if (!cancelled) {
          setData({
            attributions: [],
            summary: null,
            engagement: null,
            performanceSeries: [],
            attributionByTaskId: {},
            sparklines: {},
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
  }, [audit, clientId]);

  return { data, loading };
}

function buildSparklines(
  points: DailyMetricPoint[],
  days = ENGAGEMENT_PERIOD_DAYS
): Record<string, number[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const recent = points.filter((p) => p.date >= cutoffDate);
  const dates = [...new Set(recent.map((p) => p.date))].sort();
  const metrics = ["calls", "direction_requests", "website_clicks", "profile_views"] as const;
  const keyMap: Record<(typeof metrics)[number], string> = {
    calls: "calls",
    direction_requests: "directions",
    website_clicks: "website",
    profile_views: "views",
  };

  const result: Record<string, number[]> = {};
  for (const metric of metrics) {
    result[keyMap[metric]] = dates.map((date) => {
      const point = recent.find((p) => p.date === date && p.metric === metric);
      return point?.value ?? 0;
    });
  }
  return result;
}
