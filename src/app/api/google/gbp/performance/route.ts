import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  fetchGbpPerformanceData,
  fetchMultiDailyMetricsTimeSeries,
  getDailyMetricsTimeSeries,
  GBP_DAILY_METRICS,
  listSearchKeywordImpressionsMonthly,
  probePerformanceApiAccess,
} from "@/lib/google/gbp-performance";
import { analyzeGbpPerformanceCoverage } from "@/lib/google/gbp-performance-coverage";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.gbpConnection) {
    return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
  }

  const connection = await getValidGbpConnection(user.id, business);
  if (!connection) {
    return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "probe";

  try {
    if (mode === "metrics") {
      const periodDays = Number(searchParams.get("periodDays") ?? "30");
      const data = await fetchGbpPerformanceData(connection, periodDays, {
        platformEmail: user.email ?? undefined,
      });
      return NextResponse.json({ data, coverage: data.coverage });
    }

    if (mode === "keywords") {
      const months = Number(searchParams.get("months") ?? "3");
      const keywords = await listSearchKeywordImpressionsMonthly(connection, months);
      return NextResponse.json({ keywords, count: keywords.length });
    }

    if (mode === "daily") {
      const metric = searchParams.get("metric") ?? "CALL_CLICKS";
      const days = Number(searchParams.get("days") ?? "30");
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      const series =
        searchParams.get("batch") === "1"
          ? await fetchMultiDailyMetricsTimeSeries(connection, [metric], start, end)
          : await getDailyMetricsTimeSeries(connection, metric, start, end);

      return NextResponse.json({ metric, days, series });
    }

    if (mode === "catalog") {
      return NextResponse.json({
        dailyMetrics: GBP_DAILY_METRICS,
        methods: [
          "locations.fetchMultiDailyMetricsTimeSeries",
          "locations.getDailyMetricsTimeSeries",
          "locations.searchkeywords.impressions.monthly.list",
        ],
      });
    }

    const probe = await probePerformanceApiAccess(connection, {
      platformEmail: user.email ?? undefined,
    });

    const sampleData = probe.sampleMetrics
      ? {
          source: "api" as const,
          calls: probe.sampleMetrics.calls,
          directionRequests: probe.sampleMetrics.directionRequests,
          websiteClicks: probe.sampleMetrics.websiteClicks,
          profileViews: probe.sampleMetrics.profileViews,
          impressionsMaps: 0,
          impressionsSearch: 0,
          conversations: 0,
          bookings: 0,
          searchKeywords: [],
          periodDays: 7,
        }
      : {
          source: "unavailable" as const,
          calls: 0,
          directionRequests: 0,
          websiteClicks: 0,
          profileViews: 0,
          impressionsMaps: 0,
          impressionsSearch: 0,
          conversations: 0,
          bookings: 0,
          searchKeywords: [],
          periodDays: 7,
        };

    return NextResponse.json({
      ...probe,
      coverage: analyzeGbpPerformanceCoverage(sampleData, probe),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Performance API request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
