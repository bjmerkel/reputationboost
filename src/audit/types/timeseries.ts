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
