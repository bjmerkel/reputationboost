/** Normalized daily performance metric names stored in performance_daily. */
export type PerformanceDailyMetric =
  | "calls"
  | "direction_requests"
  | "website_clicks"
  | "profile_views"
  | "impressions_maps"
  | "impressions_search"
  | "conversations"
  | "bookings";

export interface DailyMetricPoint {
  date: string;
  metric: PerformanceDailyMetric;
  value: number;
}

export interface PerformanceDailyRow {
  businessId: string;
  date: string;
  metric: PerformanceDailyMetric;
  value: number;
  source: "api" | "audit_backfill";
}

export interface RankSnapshotRow {
  businessId: string;
  keyword: string;
  date: string;
  distanceMiles: number;
  gridNorth: number;
  gridEast: number;
  rank: number | null;
  inLocalPack: boolean;
  localPackPosition: number | null;
  source: "api" | "audit_backfill";
}

export interface IngestRunResult {
  jobName: string;
  businessesProcessed: number;
  performanceRowsUpserted: number;
  rankRowsUpserted: number;
  errors: Array<{ businessId: string; step: string; message: string }>;
}

export interface ActionAttribution {
  id: string;
  executionTaskId: string;
  businessId: string;
  taskType: string;
  actionItemId: string;
  title: string;
  publishedAt: string;
  windowDays: number;
  primaryKeyword: string | null;
  rankBefore: number | null;
  rankAfter: number | null;
  rankDelta: number | null;
  keywordsImproved: number;
  callsDelta: number | null;
  directionsDelta: number | null;
  websiteClicksDelta: number | null;
  impressionsDelta: number | null;
  estimatedRevenue: number | null;
  narrative: string;
  preliminary: boolean;
  computedAt: string;
}

export interface AttributionSummary {
  period: string;
  periodDays: number;
  tasksCompleted: number;
  keywordsImproved: number;
  totalCallsDelta: number;
  totalDirectionsDelta: number;
  totalWebsiteClicksDelta: number;
  totalEstimatedRevenue: number | null;
  topWins: ActionAttribution[];
}
