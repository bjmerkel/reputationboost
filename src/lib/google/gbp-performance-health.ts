import type { GbpPerformanceCoverage } from "@/audit/types";

export interface PerformanceEndpointStatus {
  key: "coreMetrics" | "impressions" | "searchKeywords";
  label: string;
  status: string;
  ok: boolean;
}

export interface PerformanceHealthReport {
  overallScore: number;
  apiAvailable: boolean;
  partialApi: boolean;
  endpointStatus: PerformanceEndpointStatus[];
  actionRate: number;
  totalActions: number;
  keywordCount: number;
  trackedKeywordCount: number;
  hasConversations: boolean;
  hasBookings: boolean;
  recommendations: string[];
}

const ENDPOINT_LABELS: Record<PerformanceEndpointStatus["key"], string> = {
  coreMetrics: "Action metrics",
  impressions: "Profile views",
  searchKeywords: "Search keywords",
};

function endpointOk(status: string): boolean {
  return status === "ok";
}

/** Summarize performance API health for dashboard display. */
export function buildPerformanceHealthReport(
  coverage: GbpPerformanceCoverage
): PerformanceHealthReport {
  const endpointStatus: PerformanceEndpointStatus[] = (
    ["coreMetrics", "impressions", "searchKeywords"] as const
  ).map((key) => ({
    key,
    label: ENDPOINT_LABELS[key],
    status: coverage.endpoints[key],
    ok: endpointOk(coverage.endpoints[key]),
  }));

  return {
    overallScore: coverage.coverageScore,
    apiAvailable: coverage.apiAvailable,
    partialApi: coverage.partialApi,
    endpointStatus,
    actionRate: coverage.actionRate,
    totalActions: coverage.totalActions,
    keywordCount: coverage.keywordCount,
    trackedKeywordCount: coverage.trackedKeywordCount,
    hasConversations: coverage.hasConversations,
    hasBookings: coverage.hasBookings,
    recommendations: coverage.recommendations,
  };
}
