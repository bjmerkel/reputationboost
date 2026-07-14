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

/** When nightly ingest last wrote customer-action metrics for a business. */
export interface PerformanceIngestMeta {
  /** Latest calendar date with ingested action metrics (YYYY-MM-DD). */
  latestDataDate: string | null;
  /** When rows for latestDataDate were written (ISO timestamp). */
  lastIngestedAt: string | null;
}

export interface PerformanceDailyRow {
  businessId: string;
  date: string;
  metric: PerformanceDailyMetric;
  value: number;
  source: "api" | "audit_backfill";
}

export type RankingModel = "legacy_nearby_radius" | "radial_text_v2";

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
  source: "api" | "audit_backfill" | "deferred";
  rankingModel?: RankingModel;
}

export interface IngestRunResult {
  jobName: string;
  businessesProcessed: number;
  performanceRowsUpserted: number;
  rankRowsUpserted: number;
  scoreRowsUpserted: number;
  calibrationStepsUpdated: number;
  /** Plan reconcile: execution tasks appended during daily ingest. */
  planTasksCreated?: number;
  /** Plan reconcile: stale pending tasks auto-completed during daily ingest. */
  planTasksAutoCompleted?: number;
  /** Businesses where plan reconcile ran successfully. */
  planReconcileBusinesses?: number;
  /** Places rank searches executed after GBP-guided planning. */
  rankScansLive?: number;
  /** Paid rank searches replaced with a carried-forward rank. */
  rankScansDeferred?: number;
  /** Deferred keywords rotated back into a live scan. */
  rankScansForced?: number;
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
  gridCoverageBefore?: number | null;
  gridCoverageAfter?: number | null;
  cellsImproved?: number | null;
  projectedDriverImpact?: number | null;
  observedDriverImpact?: number | null;
  driverScoreBefore?: number | null;
  driverScoreAfter?: number | null;
  projectedOutcomeImpact?: number | null;
  projectedRevenueGain?: number | null;
  observedOutcomeImpact?: number | null;
  outcomeIndexBefore?: number | null;
  outcomeIndexAfter?: number | null;
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
  avgCustomerValue: number | null;
  currency: string;
  hasCustomerValue: boolean;
  topWins: ActionAttribution[];
}

export interface ScoreDailySnapshot {
  businessId: string;
  date: string;
  overall: number;
  driverScore?: number;
  outcomeIndex?: number;
  visibility: number;
  conversion: number;
  revenueCapture: number;
  source: "ingest" | "audit";
}

export interface ScoreHistoryResponse {
  series: ScoreDailySnapshot[];
  changelog: Array<{
    component: string;
    delta: number;
    label: string;
    keyword?: string;
  }>;
  latestDate: string | null;
  days: number;
  globalCalibration?: import("@/audit/phase2/attribution-calibration").AttributionCalibration;
  scoreModel?: import("@/audit/phase2/score-learning").LearnedScoreModel;
}
