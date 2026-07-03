import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";

const PERFORMANCE_BASE = "https://businessprofileperformance.googleapis.com/v1";

const DAILY_METRICS = [
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_BOOKINGS",
] as const;

export interface GbpSearchKeywordImpression {
  keyword: string;
  impressions: number | null;
  belowThreshold: boolean;
}

export interface GbpPerformanceData {
  periodDays: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  profileViews: number;
  impressionsMaps: number;
  impressionsSearch: number;
  conversations: number;
  bookings: number;
  searchKeywords: GbpSearchKeywordImpression[];
  source: "api" | "unavailable";
  error?: string;
}

function normalizeLocationId(locationId: string): string {
  return locationId.replace(/^locations\//, "");
}

function dateParts(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function appendDailyRange(
  url: URL,
  start: Date,
  end: Date,
  prefix = "dailyRange"
): void {
  const s = dateParts(start);
  const e = dateParts(end);
  url.searchParams.set(`${prefix}.start_date.year`, String(s.year));
  url.searchParams.set(`${prefix}.start_date.month`, String(s.month));
  url.searchParams.set(`${prefix}.start_date.day`, String(s.day));
  url.searchParams.set(`${prefix}.end_date.year`, String(e.year));
  url.searchParams.set(`${prefix}.end_date.month`, String(e.month));
  url.searchParams.set(`${prefix}.end_date.day`, String(e.day));
}

interface TimeSeriesResponse {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: string;
      timeSeries?: { datedValues?: Array<{ value?: string | number }> };
    }>;
  }>;
  error?: { message?: string; status?: string };
}

function parseMetricTotals(data: TimeSeriesResponse): Record<string, number> {
  const totals: Record<string, number> = {};
  const allSeries = (data.multiDailyMetricTimeSeries ?? []).flatMap(
    (batch) => batch.dailyMetricTimeSeries ?? []
  );

  for (const entry of allSeries) {
    const metric = entry.dailyMetric;
    if (!metric) continue;
    const values = entry.timeSeries?.datedValues ?? [];
    totals[metric] = values.reduce((sum, dv) => sum + Number(dv.value ?? 0), 0);
  }

  return totals;
}

async function fetchDailyMetrics(
  connection: GbpConnection,
  periodDays: number
): Promise<Record<string, number>> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  const locationId = normalizeLocationId(connection.locationId);
  const url = new URL(
    `${PERFORMANCE_BASE}/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`
  );

  for (const metric of DAILY_METRICS) {
    url.searchParams.append("dailyMetrics", metric);
  }
  appendDailyRange(url, start, end);

  const res = await fetch(url.toString(), {
    headers: authHeadersForConnection(connection),
  });
  const data = (await res.json()) as TimeSeriesResponse;

  if (!res.ok) {
    throw new Error(
      data.error?.message ??
        `Performance API failed (${res.status}). Enable Business Profile Performance API in Google Cloud and ensure GBP API access is approved.`
    );
  }

  return parseMetricTotals(data);
}

async function fetchSearchKeywordImpressions(
  connection: GbpConnection,
  monthsBack = 3
): Promise<GbpSearchKeywordImpression[]> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);

  const locationId = normalizeLocationId(connection.locationId);

  const keywords: GbpSearchKeywordImpression[] = [];
  let pageToken: string | undefined;

  do {
    const pageUrl = new URL(
      `${PERFORMANCE_BASE}/locations/${locationId}/searchkeywords/impressions/monthly`
    );
    pageUrl.searchParams.set("monthlyRange.start_month.year", String(start.getFullYear()));
    pageUrl.searchParams.set("monthlyRange.start_month.month", String(start.getMonth() + 1));
    pageUrl.searchParams.set("monthlyRange.end_month.year", String(end.getFullYear()));
    pageUrl.searchParams.set("monthlyRange.end_month.month", String(end.getMonth() + 1));
    pageUrl.searchParams.set("pageSize", "100");
    if (pageToken) pageUrl.searchParams.set("pageToken", pageToken);

    const res = await fetch(pageUrl.toString(), {
      headers: authHeadersForConnection(connection),
    });
    const data = (await res.json()) as {
      searchKeywordsCounts?: Array<{
        searchKeyword?: string;
        insightsValue?: { value?: string; threshold?: string };
      }>;
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        data.error?.message ?? `Search keywords API failed (${res.status})`
      );
    }

    for (const item of data.searchKeywordsCounts ?? []) {
      const insights = item.insightsValue;
      keywords.push({
        keyword: item.searchKeyword ?? "",
        impressions: insights?.value != null ? Number(insights.value) : null,
        belowThreshold: Boolean(insights?.threshold && !insights?.value),
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && keywords.length < 200);

  return keywords;
}

function buildPerformanceFromTotals(
  totals: Record<string, number>,
  searchKeywords: GbpSearchKeywordImpression[],
  periodDays: number
): GbpPerformanceData {
  const impressionsMaps =
    (totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0) +
    (totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0);
  const impressionsSearch =
    (totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) +
    (totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0);

  return {
    periodDays,
    calls: totals.CALL_CLICKS ?? 0,
    directionRequests: totals.BUSINESS_DIRECTION_REQUESTS ?? 0,
    websiteClicks: totals.WEBSITE_CLICKS ?? 0,
    profileViews: impressionsMaps + impressionsSearch,
    impressionsMaps,
    impressionsSearch,
    conversations: totals.BUSINESS_CONVERSATIONS ?? 0,
    bookings: totals.BUSINESS_BOOKINGS ?? 0,
    searchKeywords,
    source: "api",
  };
}

export function emptyPerformanceData(
  periodDays = 30,
  error?: string
): GbpPerformanceData {
  return {
    periodDays,
    calls: 0,
    directionRequests: 0,
    websiteClicks: 0,
    profileViews: 0,
    impressionsMaps: 0,
    impressionsSearch: 0,
    conversations: 0,
    bookings: 0,
    searchKeywords: [],
    source: "unavailable",
    error,
  };
}

/** Fetch GBP Performance API metrics: calls, directions, website clicks, profile views, search keywords. */
export async function fetchGbpPerformanceData(
  connection: GbpConnection,
  periodDays = 30
): Promise<GbpPerformanceData> {
  const [totals, searchKeywords] = await Promise.all([
    fetchDailyMetrics(connection, periodDays),
    fetchSearchKeywordImpressions(connection).catch((err) => {
      console.warn("[gbp-performance] search keywords fetch failed:", err);
      return [] as GbpSearchKeywordImpression[];
    }),
  ]);

  return buildPerformanceFromTotals(totals, searchKeywords, periodDays);
}
