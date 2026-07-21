export type RevenueMatchMethod =
  | "service_keyword"
  | "fuzzy_keyword"
  | "impression_fallback"
  | "lead_source"
  | "call_log"
  | "manual";

export type RevenueAmountType = "invoice" | "job" | "estimate";

export interface RevenueTransactionRecord {
  id: string;
  businessId: string;
  userId: string;
  customerId: string | null;
  customerEventId: string | null;
  externalId: string | null;
  source: string;
  eventType: string;
  amount: number;
  currency: string;
  occurredAt: string;
  matchedKeyword: string | null;
  matchedGridNorth: number | null;
  matchedGridEast: number | null;
  matchedZone: string | null;
  matchMethod: RevenueMatchMethod | null;
  matchConfidence: number | null;
  gbpCallMatched: boolean;
  createdAt: string;
}

export interface KeywordRevenueMonthly {
  businessId: string;
  keyword: string;
  month: string;
  observedRevenue: number;
  observedJobs: number;
  modeledRevenue: number | null;
  avgRank: number | null;
  impressions: number | null;
}

export interface GridCellRevenueMonthly {
  businessId: string;
  keyword: string;
  gridNorth: number;
  gridEast: number;
  month: string;
  observedRevenue: number;
  observedJobs: number;
  modeledRevenue: number | null;
  avgRank: number | null;
}

export interface RevenueContext {
  observedJobCount: number;
  observedRevenueTotal: number;
  observedAcv: number | null;
  keywordObservedRevenue: Map<string, number>;
  cellObservedRevenue: Map<string, number>;
}

export interface RankValueDelta {
  modeledDeltaPerMonth: number;
  observedDeltaPerMonth: number | null;
  confidence: "high" | "medium" | "low";
  headline: string;
}
