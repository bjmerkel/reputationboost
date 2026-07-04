import type { GbpConnection } from "@/audit/types";
import type { DailyMetricPoint, PerformanceDailyMetric } from "@/audit/types/timeseries";
import { checkGbpLocationAccess, type GbpLocationAccessCheck, resolveGoogleAccountEmail } from "./gbp-access";
import { authHeadersForConnection } from "./auth-headers";
import { getGbpLocationProfile } from "./gbp-location";
import type { GbpPerformanceCoverage } from "./gbp-performance-coverage";
import { analyzeGbpPerformanceCoverage } from "./gbp-performance-coverage";
import {
  formatPerformanceError,
  isPerformancePermissionError,
  performanceSetupSteps,
} from "./performance-errors";

const PERFORMANCE_BASE = "https://businessprofileperformance.googleapis.com/v1";

/** Core action metrics — fetched first. */
const CORE_METRICS = [
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
] as const;

/** Profile view / impression metrics. */
const VIEW_IMPRESSION_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
] as const;

/** Optional metrics — not all locations support these in batch requests. */
const OPTIONAL_METRICS = ["BUSINESS_CONVERSATIONS", "BUSINESS_BOOKINGS"] as const;

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
  warnings?: string[];
  accessCheck?: GbpLocationAccessCheck;
  coverage?: GbpPerformanceCoverage;
}

export type PerformanceEndpointStatus = "ok" | "failed" | "denied" | "skipped";

export interface PerformanceApiProbe {
  ok: boolean;
  httpStatus?: number;
  error?: string;
  permissionDenied: boolean;
  partial?: boolean;
  setupSteps: string[];
  sampleMetrics?: Pick<GbpPerformanceData, "calls" | "directionRequests" | "websiteClicks" | "profileViews">;
  endpoints?: {
    coreMetrics: PerformanceEndpointStatus;
    impressions: PerformanceEndpointStatus;
    searchKeywords: PerformanceEndpointStatus;
  };
  accessCheck?: GbpLocationAccessCheck;
  platformEmail?: string;
  googleAccountEmail?: string;
  accountMismatch?: boolean;
}

function performanceHeaders(connection: GbpConnection): HeadersInit {
  return {
    ...authHeadersForConnection(connection),
    "X-GOOG-API-FORMAT-VERSION": "2",
  };
}

function normalizeLocationId(locationId: string): string {
  return locationId.replace(/^locations\//, "");
}

function dateParts(d: Date) {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

type DateRangeFormat = "snake" | "camel";

function appendDailyRange(
  url: URL,
  start: Date,
  end: Date,
  format: DateRangeFormat = "snake"
): void {
  const s = dateParts(start);
  const e = dateParts(end);

  if (format === "snake") {
    url.searchParams.set("dailyRange.start_date.year", String(s.year));
    url.searchParams.set("dailyRange.start_date.month", String(s.month));
    url.searchParams.set("dailyRange.start_date.day", String(s.day));
    url.searchParams.set("dailyRange.end_date.year", String(e.year));
    url.searchParams.set("dailyRange.end_date.month", String(e.month));
    url.searchParams.set("dailyRange.end_date.day", String(e.day));
    return;
  }

  url.searchParams.set("dailyRange.startDate.year", String(s.year));
  url.searchParams.set("dailyRange.startDate.month", String(s.month));
  url.searchParams.set("dailyRange.startDate.day", String(s.day));
  url.searchParams.set("dailyRange.endDate.year", String(e.year));
  url.searchParams.set("dailyRange.endDate.month", String(e.month));
  url.searchParams.set("dailyRange.endDate.day", String(e.day));
}

interface DatedValue {
  date?: { year?: number; month?: number; day?: number };
  value?: string | number;
}

interface TimeSeriesResponse {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: string;
      timeSeries?: { datedValues?: DatedValue[] };
    }>;
  }>;
  timeSeries?: { datedValues?: DatedValue[] };
  error?: { message?: string; status?: string; code?: number };
}

const API_METRIC_TO_DAILY: Record<string, PerformanceDailyMetric> = {
  CALL_CLICKS: "calls",
  BUSINESS_DIRECTION_REQUESTS: "direction_requests",
  WEBSITE_CLICKS: "website_clicks",
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "impressions_maps",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "impressions_maps",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "impressions_search",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "impressions_search",
  BUSINESS_CONVERSATIONS: "conversations",
  BUSINESS_BOOKINGS: "bookings",
};

const DAILY_INGEST_METRICS = [
  ...CORE_METRICS,
  ...VIEW_IMPRESSION_METRICS,
  ...OPTIONAL_METRICS,
] as const;

function formatDatedValueDate(date: DatedValue["date"]): string | null {
  if (!date?.year || !date.month || !date.day) return null;
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

/** Parse daily metric points from a multi-metric time-series response. */
export function parseMetricDaily(data: TimeSeriesResponse): DailyMetricPoint[] {
  const byDateMetric = new Map<string, number>();
  const allSeries = (data.multiDailyMetricTimeSeries ?? []).flatMap(
    (batch) => batch.dailyMetricTimeSeries ?? []
  );

  for (const entry of allSeries) {
    const metric = entry.dailyMetric ? API_METRIC_TO_DAILY[entry.dailyMetric] : undefined;
    if (!metric) continue;

    for (const dv of entry.timeSeries?.datedValues ?? []) {
      const date = formatDatedValueDate(dv.date);
      if (!date) continue;
      const key = `${date}:${metric}`;
      byDateMetric.set(key, (byDateMetric.get(key) ?? 0) + Number(dv.value ?? 0));
    }
  }

  const points: DailyMetricPoint[] = [];
  for (const [key, value] of byDateMetric) {
    const [date, metric] = key.split(":") as [string, PerformanceDailyMetric];
    points.push({ date, metric, value });
  }

  // Derive profile_views = impressions_maps + impressions_search per day
  const dates = new Set(points.map((p) => p.date));
  for (const date of dates) {
    const maps = points.find((p) => p.date === date && p.metric === "impressions_maps")?.value ?? 0;
    const search =
      points.find((p) => p.date === date && p.metric === "impressions_search")?.value ?? 0;
    if (maps + search > 0) {
      points.push({ date, metric: "profile_views", value: maps + search });
    }
  }

  return points.sort((a, b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric));
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

function sumTimeSeriesValues(data: TimeSeriesResponse): number {
  const values = data.timeSeries?.datedValues ?? [];
  return values.reduce((sum, dv) => sum + Number(dv.value ?? 0), 0);
}

function endpointStatusFromError(error: unknown): PerformanceEndpointStatus {
  const httpStatus = (error as Error & { httpStatus?: number }).httpStatus;
  if (httpStatus === 403) return "denied";
  return "failed";
}

async function resolvePerformanceConnection(
  connection: GbpConnection
): Promise<GbpConnection> {
  try {
    const profile = await getGbpLocationProfile(connection);
    const canonicalId = normalizeLocationId(profile.locationName);
    const currentId = normalizeLocationId(connection.locationId);
    if (canonicalId && canonicalId !== currentId) {
      return { ...connection, locationId: canonicalId };
    }
  } catch {
    // Use the stored location id when profile lookup fails.
  }
  return connection;
}

async function fetchMetricsBatch(
  connection: GbpConnection,
  metrics: readonly string[],
  periodDays: number,
  dateFormat: DateRangeFormat = "snake"
): Promise<{ totals: Record<string, number>; httpStatus: number }> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  const locationId = normalizeLocationId(connection.locationId);
  const url = new URL(
    `${PERFORMANCE_BASE}/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`
  );

  for (const metric of metrics) {
    url.searchParams.append("dailyMetrics", metric);
  }
  appendDailyRange(url, start, end, dateFormat);

  const res = await fetch(url.toString(), { headers: performanceHeaders(connection) });
  const data = (await res.json()) as TimeSeriesResponse;

  if (!res.ok) {
    const err = new Error(data.error?.message ?? `Performance API failed (${res.status})`);
    (err as Error & { httpStatus?: number }).httpStatus = res.status;
    throw err;
  }

  return { totals: parseMetricTotals(data), httpStatus: res.status };
}

async function fetchMetricsBatchRaw(
  connection: GbpConnection,
  metrics: readonly string[],
  start: Date,
  end: Date,
  dateFormat: DateRangeFormat = "snake"
): Promise<TimeSeriesResponse> {
  const locationId = normalizeLocationId(connection.locationId);
  const url = new URL(
    `${PERFORMANCE_BASE}/locations/${locationId}:fetchMultiDailyMetricsTimeSeries`
  );

  for (const metric of metrics) {
    url.searchParams.append("dailyMetrics", metric);
  }
  appendDailyRange(url, start, end, dateFormat);

  const res = await fetch(url.toString(), { headers: performanceHeaders(connection) });
  const data = (await res.json()) as TimeSeriesResponse;

  if (!res.ok) {
    const err = new Error(data.error?.message ?? `Performance API failed (${res.status})`);
    (err as Error & { httpStatus?: number }).httpStatus = res.status;
    throw err;
  }

  return data;
}

async function fetchMetricsDailyWithFallback(
  connection: GbpConnection,
  metrics: readonly string[],
  start: Date,
  end: Date
): Promise<DailyMetricPoint[]> {
  const formats: DateRangeFormat[] = ["snake", "camel"];

  for (const format of formats) {
    try {
      const data = await fetchMetricsBatchRaw(connection, metrics, start, end, format);
      const points = parseMetricDaily(data);
      if (points.length > 0) return points;
    } catch {
      // Try alternate date param format.
    }
  }

  return [];
}

/** Fetch daily performance metrics for a date range (preserves per-day values). */
export async function fetchGbpPerformanceDailySeries(
  connection: GbpConnection,
  startDate: Date,
  endDate: Date
): Promise<DailyMetricPoint[]> {
  const resolved = await resolvePerformanceConnection(connection);
  const corePoints = await fetchMetricsDailyWithFallback(
    resolved,
    CORE_METRICS,
    startDate,
    endDate
  );

  if (corePoints.length === 0) {
    const err = new Error("Performance API: no daily core metrics returned for this location.");
    (err as Error & { httpStatus?: number }).httpStatus = 403;
    throw err;
  }

  const allPoints = [...corePoints];

  try {
    const impressionPoints = await fetchMetricsDailyWithFallback(
      resolved,
      VIEW_IMPRESSION_METRICS,
      startDate,
      endDate
    );
    allPoints.push(...impressionPoints);
  } catch {
    // Impressions are optional for daily ingest.
  }

  try {
    const optionalPoints = await fetchMetricsDailyWithFallback(
      resolved,
      OPTIONAL_METRICS,
      startDate,
      endDate
    );
    allPoints.push(...optionalPoints);
  } catch {
    // Bookings/conversations are optional.
  }

  // Re-merge and re-derive profile_views across all metrics
  const merged = new Map<string, number>();
  for (const point of allPoints) {
    const key = `${point.date}:${point.metric}`;
    merged.set(key, (merged.get(key) ?? 0) + point.value);
  }

  const dates = new Set(allPoints.map((p) => p.date));
  for (const date of dates) {
    const maps = merged.get(`${date}:impressions_maps`) ?? 0;
    const search = merged.get(`${date}:impressions_search`) ?? 0;
    if (maps + search > 0) {
      merged.set(`${date}:profile_views`, maps + search);
    }
  }

  const result: DailyMetricPoint[] = [];
  for (const [key, value] of merged) {
    const [date, metric] = key.split(":") as [string, PerformanceDailyMetric];
    result.push({ date, metric, value });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date) || a.metric.localeCompare(b.metric));
}

/** Metric names ingested into performance_daily during daily cron. */
export const DAILY_PERFORMANCE_METRICS = DAILY_INGEST_METRICS;

/** All daily metrics supported by fetchMultiDailyMetricsTimeSeries. */
export const GBP_DAILY_METRICS = DAILY_INGEST_METRICS;

/** locations.getDailyMetricsTimeSeries — single metric daily series. */
export async function getDailyMetricsTimeSeries(
  connection: GbpConnection,
  metric: string,
  startDate: Date,
  endDate: Date
): Promise<DailyMetricPoint[]> {
  const resolved = await resolvePerformanceConnection(connection);
  const formats: DateRangeFormat[] = ["snake", "camel"];

  for (const format of formats) {
    try {
      const end = endDate;
      const start = startDate;
      const locationId = normalizeLocationId(resolved.locationId);
      const url = new URL(
        `${PERFORMANCE_BASE}/locations/${locationId}:getDailyMetricsTimeSeries`
      );
      url.searchParams.set("dailyMetric", metric);
      appendDailyRange(url, start, end, format);

      const res = await fetch(url.toString(), { headers: performanceHeaders(resolved) });
      const data = (await res.json()) as TimeSeriesResponse;

      if (!res.ok) {
        const err = new Error(data.error?.message ?? `Performance API failed (${res.status})`);
        (err as Error & { httpStatus?: number }).httpStatus = res.status;
        throw err;
      }

      const mapped = API_METRIC_TO_DAILY[metric];
      if (!mapped) return [];

      return (data.timeSeries?.datedValues ?? [])
        .map((dv) => {
          const date = formatDatedValueDate(dv.date);
          if (!date) return null;
          return { date, metric: mapped, value: Number(dv.value ?? 0) };
        })
        .filter((point): point is DailyMetricPoint => point !== null);
    } catch {
      // Try alternate date param format.
    }
  }

  return await fetchMetricsDailyWithFallback(resolved, [metric], startDate, endDate);
}

/** locations.fetchMultiDailyMetricsTimeSeries — batch daily metrics. */
export async function fetchMultiDailyMetricsTimeSeries(
  connection: GbpConnection,
  metrics: readonly string[],
  startDate: Date,
  endDate: Date
): Promise<DailyMetricPoint[]> {
  return fetchMetricsDailyWithFallback(connection, metrics, startDate, endDate);
}

async function fetchSingleMetric(
  connection: GbpConnection,
  metric: string,
  periodDays: number,
  dateFormat: DateRangeFormat = "snake"
): Promise<number> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - periodDays);

  const locationId = normalizeLocationId(connection.locationId);
  const url = new URL(
    `${PERFORMANCE_BASE}/locations/${locationId}:getDailyMetricsTimeSeries`
  );
  url.searchParams.set("dailyMetric", metric);
  appendDailyRange(url, start, end, dateFormat);

  const res = await fetch(url.toString(), { headers: performanceHeaders(connection) });
  const data = (await res.json()) as TimeSeriesResponse;

  if (!res.ok) {
    const err = new Error(data.error?.message ?? `Performance API failed (${res.status})`);
    (err as Error & { httpStatus?: number }).httpStatus = res.status;
    throw err;
  }

  return sumTimeSeriesValues(data);
}

async function fetchMetricsWithFallback(
  connection: GbpConnection,
  metrics: readonly string[],
  periodDays: number
): Promise<Record<string, number>> {
  const formats: DateRangeFormat[] = ["snake", "camel"];

  for (const format of formats) {
    try {
      const { totals } = await fetchMetricsBatch(connection, metrics, periodDays, format);
      return totals;
    } catch {
      // Try alternate date param format or per-metric fallback.
    }
  }

  const totals: Record<string, number> = {};
  for (const metric of metrics) {
    for (const format of formats) {
      try {
        totals[metric] = await fetchSingleMetric(connection, metric, periodDays, format);
        break;
      } catch {
        // Try next format or metric.
      }
    }
  }

  return totals;
}

function hasAnyCoreMetrics(totals: Record<string, number>): boolean {
  return CORE_METRICS.some((metric) => totals[metric] !== undefined);
}

async function fetchDailyMetrics(
  connection: GbpConnection,
  periodDays: number
): Promise<{ totals: Record<string, number>; warnings: string[] }> {
  const warnings: string[] = [];
  const totals: Record<string, number> = {};

  const coreTotals = await fetchMetricsWithFallback(connection, CORE_METRICS, periodDays);
  Object.assign(totals, coreTotals);

  if (!hasAnyCoreMetrics(totals)) {
    const err = new Error("Performance API: no core metrics returned for this location.");
    (err as Error & { httpStatus?: number }).httpStatus = 403;
    throw err;
  }

  try {
    const impressionTotals = await fetchMetricsWithFallback(
      connection,
      VIEW_IMPRESSION_METRICS,
      periodDays
    );
    Object.assign(totals, impressionTotals);
  } catch (error) {
    const status = endpointStatusFromError(error);
    warnings.push(
      status === "denied"
        ? "Profile view counts aren't available for this location."
        : "Profile view counts couldn't be loaded."
    );
  }

  try {
    const optionalTotals = await fetchMetricsWithFallback(
      connection,
      OPTIONAL_METRICS,
      periodDays
    );
    Object.assign(totals, optionalTotals);
  } catch {
    // Bookings/conversations are optional for most businesses.
  }

  return { totals, warnings };
}

async function fetchSearchKeywordImpressionsPage(
  connection: GbpConnection,
  start: Date,
  end: Date,
  format: "snake" | "camel"
): Promise<GbpSearchKeywordImpression[]> {
  const locationId = normalizeLocationId(connection.locationId);
  const keywords: GbpSearchKeywordImpression[] = [];
  let pageToken: string | undefined;

  do {
    const pageUrl = new URL(
      `${PERFORMANCE_BASE}/locations/${locationId}/searchkeywords/impressions/monthly`
    );

    if (format === "snake") {
      pageUrl.searchParams.set("monthlyRange.start_month.year", String(start.getFullYear()));
      pageUrl.searchParams.set("monthlyRange.start_month.month", String(start.getMonth() + 1));
      pageUrl.searchParams.set("monthlyRange.end_month.year", String(end.getFullYear()));
      pageUrl.searchParams.set("monthlyRange.end_month.month", String(end.getMonth() + 1));
    } else {
      pageUrl.searchParams.set("monthlyRange.startMonth.year", String(start.getFullYear()));
      pageUrl.searchParams.set("monthlyRange.startMonth.month", String(start.getMonth() + 1));
      pageUrl.searchParams.set("monthlyRange.endMonth.year", String(end.getFullYear()));
      pageUrl.searchParams.set("monthlyRange.endMonth.month", String(end.getMonth() + 1));
    }

    pageUrl.searchParams.set("pageSize", "100");
    if (pageToken) pageUrl.searchParams.set("pageToken", pageToken);

    const res = await fetch(pageUrl.toString(), { headers: performanceHeaders(connection) });
    const data = (await res.json()) as {
      searchKeywordsCounts?: Array<{
        searchKeyword?: string;
        insightsValue?: { value?: string; threshold?: string };
      }>;
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      const err = new Error(data.error?.message ?? `Search keywords API failed (${res.status})`);
      (err as Error & { httpStatus?: number }).httpStatus = res.status;
      throw err;
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

/** locations.searchkeywords.impressions.monthly.list */
export async function listSearchKeywordImpressionsMonthly(
  connection: GbpConnection,
  monthsBack = 3
): Promise<GbpSearchKeywordImpression[]> {
  const resolved = await resolvePerformanceConnection(connection);
  return fetchSearchKeywordImpressions(resolved, monthsBack);
}

async function fetchSearchKeywordImpressions(
  connection: GbpConnection,
  monthsBack = 3
): Promise<GbpSearchKeywordImpression[]> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);

  for (const format of ["snake", "camel"] as const) {
    try {
      const keywords = await fetchSearchKeywordImpressionsPage(connection, start, end, format);
      if (keywords.length > 0) return keywords;
    } catch {
      // Try alternate monthly range param format.
    }
  }

  return [];
}

function buildPerformanceFromTotals(
  totals: Record<string, number>,
  searchKeywords: GbpSearchKeywordImpression[],
  periodDays: number,
  warnings: string[] = []
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
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function emptyPerformanceData(
  periodDays = 30,
  error?: string,
  accessCheck?: GbpLocationAccessCheck
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
    accessCheck,
  };
}

async function probeEndpoint(
  connection: GbpConnection,
  probe: () => Promise<unknown>
): Promise<PerformanceEndpointStatus> {
  try {
    await probe();
    return "ok";
  } catch (error) {
    return endpointStatusFromError(error);
  }
}

/** Quick health check for Settings / onboarding — uses last 7 days. */
export async function probePerformanceApiAccess(
  connection: GbpConnection,
  options?: { platformEmail?: string }
): Promise<PerformanceApiProbe> {
  const setupSteps = performanceSetupSteps();
  const resolved = await resolvePerformanceConnection(connection);
  const platformEmail = options?.platformEmail?.trim().toLowerCase();
  const googleAccountEmail = await resolveGoogleAccountEmail(resolved);
  const accountMismatch = Boolean(
    platformEmail && googleAccountEmail && platformEmail !== googleAccountEmail
  );
  const accountFields = { platformEmail, googleAccountEmail, accountMismatch };

  const endpoints = {
    coreMetrics: await probeEndpoint(resolved, () =>
      fetchMetricsBatch(resolved, CORE_METRICS, 7)
    ),
    impressions: await probeEndpoint(resolved, () =>
      fetchMetricsBatch(resolved, VIEW_IMPRESSION_METRICS, 7)
    ),
    searchKeywords: await probeEndpoint(resolved, () =>
      fetchSearchKeywordImpressions(resolved, 1)
    ),
  };

  const coreOk = endpoints.coreMetrics === "ok";
  const partial =
    coreOk &&
    (endpoints.impressions !== "ok" || endpoints.searchKeywords !== "ok");
  const performanceDenied = endpoints.coreMetrics === "denied";

  if (coreOk) {
    try {
      const { totals } = await fetchMetricsBatch(resolved, CORE_METRICS, 7);
      const data = buildPerformanceFromTotals(totals, [], 7);
      return {
        ok: true,
        permissionDenied: false,
        partial,
        setupSteps,
        endpoints,
        ...accountFields,
        sampleMetrics: {
          calls: data.calls,
          directionRequests: data.directionRequests,
          websiteClicks: data.websiteClicks,
          profileViews: data.profileViews,
        },
      };
    } catch {
      // Fall through to error response below.
    }
  }

  const accessCheck = await checkGbpLocationAccess(resolved, {
    platformEmail: options?.platformEmail,
    performanceDenied,
  });

  const httpStatus = endpoints.coreMetrics === "denied" ? 403 : undefined;
  const error =
    endpoints.coreMetrics === "denied"
      ? accessCheck.detail
      : "Performance API: core metrics unavailable for this location.";

  return {
    ok: false,
    httpStatus,
    error,
    permissionDenied: endpoints.coreMetrics === "denied",
    partial,
    setupSteps,
    endpoints,
    accessCheck,
    ...accountFields,
    platformEmail: accessCheck.platformEmail ?? platformEmail,
    googleAccountEmail: accessCheck.googleAccountEmail ?? googleAccountEmail,
    accountMismatch: accessCheck.accountMismatch ?? accountMismatch,
  };
}

/** Fetch GBP Performance API metrics: calls, directions, website clicks, profile views, search keywords. */
export async function fetchGbpPerformanceData(
  connection: GbpConnection,
  periodDays = 30,
  options?: { platformEmail?: string }
): Promise<GbpPerformanceData> {
  const resolved = await resolvePerformanceConnection(connection);

  try {
    const { totals, warnings } = await fetchDailyMetrics(resolved, periodDays);

    let searchKeywords: GbpSearchKeywordImpression[] = [];
    try {
      searchKeywords = await fetchSearchKeywordImpressions(resolved);
    } catch (kwError) {
      const httpStatus = (kwError as Error & { httpStatus?: number }).httpStatus;
      if (httpStatus === 403) {
        warnings.push("Search terms people used to find you aren't available for this location.");
      } else {
        warnings.push("Search terms people used to find you couldn't be loaded.");
        console.warn("[gbp-performance] search keywords fetch failed:", kwError);
      }
    }

    const result = buildPerformanceFromTotals(totals, searchKeywords, periodDays, warnings);
    return {
      ...result,
      coverage: analyzeGbpPerformanceCoverage(result),
    };
  } catch (error) {
    const httpStatus = (error as Error & { httpStatus?: number }).httpStatus;
    const message = formatPerformanceError(error, httpStatus);
    const performanceDenied = isPerformancePermissionError(message) || httpStatus === 403;
    const accessCheck = await checkGbpLocationAccess(resolved, {
      platformEmail: options?.platformEmail,
      performanceDenied,
    });

    if (performanceDenied) {
      if (accessCheck.status === "confirmed_manager") {
        console.warn(
          "[gbp-performance] manager access confirmed but metrics denied for location",
          resolved.locationId
        );
      } else {
        console.error("[gbp-performance] permission denied:", accessCheck.detail);
      }
    } else {
      console.error("[gbp-performance] fetch failed:", message);
    }

    return {
      ...emptyPerformanceData(periodDays, accessCheck.detail, accessCheck),
      coverage: analyzeGbpPerformanceCoverage(
        emptyPerformanceData(periodDays, accessCheck.detail, accessCheck)
      ),
    };
  }
}
