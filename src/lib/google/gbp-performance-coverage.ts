import type { GbpPerformanceData, PerformanceApiProbe } from "./gbp-performance";

export interface GbpPerformanceCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  hasCoreMetrics: boolean;
  hasImpressionMetrics: boolean;
  hasSearchKeywords: boolean;
  hasConversations: boolean;
  hasBookings: boolean;
  keywordCount: number;
  trackedKeywordCount: number;
  totalActions: number;
  actionRate: number;
  endpoints: {
    coreMetrics: string;
    impressions: string;
    searchKeywords: string;
  };
  recommendations: string[];
}

function endpointLabel(status?: string): string {
  return status ?? "skipped";
}

/** Score how fully the Performance API is returning data for a location. */
export function analyzeGbpPerformanceCoverage(
  data: Pick<
    GbpPerformanceData,
    | "source"
    | "calls"
    | "directionRequests"
    | "websiteClicks"
    | "profileViews"
    | "impressionsMaps"
    | "impressionsSearch"
    | "conversations"
    | "bookings"
    | "searchKeywords"
    | "warnings"
  >,
  probe?: Pick<PerformanceApiProbe, "ok" | "partial" | "endpoints">
): GbpPerformanceCoverage {
  const apiAvailable = data.source === "api";
  const hasCoreMetrics =
    probe?.endpoints?.coreMetrics === "ok" ||
    (apiAvailable &&
      (data.calls > 0 || data.directionRequests > 0 || data.websiteClicks > 0));
  const hasImpressionMetrics =
    probe?.endpoints?.impressions === "ok" ||
    (apiAvailable && (data.impressionsMaps > 0 || data.impressionsSearch > 0));
  const hasSearchKeywords =
    probe?.endpoints?.searchKeywords === "ok" ||
    (data.searchKeywords?.some((kw) => kw.impressions != null && kw.impressions > 0) ?? false);

  const keywordCount = data.searchKeywords?.length ?? 0;
  const trackedKeywordCount =
    data.searchKeywords?.filter((kw) => kw.impressions != null && !kw.belowThreshold).length ?? 0;

  const totalActions = data.calls + data.directionRequests + data.websiteClicks;
  const actionRate =
    data.profileViews > 0 ? Math.round((totalActions / data.profileViews) * 1000) / 10 : 0;

  let coverageScore = 0;
  if (apiAvailable) coverageScore += 40;
  if (hasCoreMetrics) coverageScore += 25;
  if (hasImpressionMetrics) coverageScore += 20;
  if (hasSearchKeywords) coverageScore += 15;

  const recommendations: string[] = [];
  if (!apiAvailable) {
    recommendations.push("Reconnect GBP with a manager account that has Performance API access.");
  } else {
    if (!hasImpressionMetrics) {
      recommendations.push("Profile view and impression metrics are unavailable — check API permissions.");
    }
    if (!hasSearchKeywords) {
      recommendations.push("Search keyword impressions aren't loading — verify Performance API quota.");
    }
    if (hasImpressionMetrics && totalActions === 0 && data.profileViews > 50) {
      recommendations.push(
        "You have profile views but no call, direction, or website clicks — strengthen CTAs on your listing."
      );
    }
    if (keywordCount > 0 && trackedKeywordCount < Math.min(3, keywordCount)) {
      recommendations.push("Most search terms are below Google's reporting threshold — build relevance with posts and categories.");
    }
  }

  return {
    apiAvailable,
    partialApi: probe?.partial ?? Boolean(data.warnings?.length),
    coverageScore,
    hasCoreMetrics,
    hasImpressionMetrics,
    hasSearchKeywords,
    hasConversations: data.conversations > 0,
    hasBookings: data.bookings > 0,
    keywordCount,
    trackedKeywordCount,
    totalActions,
    actionRate,
    endpoints: {
      coreMetrics: endpointLabel(probe?.endpoints?.coreMetrics),
      impressions: endpointLabel(probe?.endpoints?.impressions),
      searchKeywords: endpointLabel(probe?.endpoints?.searchKeywords),
    },
    recommendations: recommendations.slice(0, 5),
  };
}

export function formatPerformanceCoverageSummary(coverage: GbpPerformanceCoverage): string {
  const parts: string[] = [];
  if (coverage.hasCoreMetrics) parts.push("actions");
  if (coverage.hasImpressionMetrics) parts.push("views");
  if (coverage.hasSearchKeywords) parts.push("keywords");
  return parts.length > 0 ? parts.join(" · ") : "unavailable";
}
