import type {
  KeywordPortfolioAnalysis,
  Phase1AuditPayload,
  TrackedKeywordPortfolioItem,
} from "@/audit/types";
import { computeKeywordPortfolio } from "./keyword-portfolio";

export type RankScanContext = "daily" | "weekly_grid";

export interface KeywordRankScanPlan {
  liveScan: string[];
  deferred: Array<{
    keyword: string;
    reason: string;
    prior: TrackedKeywordPortfolioItem;
  }>;
  forcedRescan: string[];
  gbpDemandAvailable: boolean;
}

function normalize(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function rotationIndex(date: string, context: RankScanContext, count: number): number {
  if (count <= 1) return 0;
  const parsed = new Date(`${date}T12:00:00.000Z`);
  const day = Math.floor(parsed.getTime() / 86_400_000);
  const period = context === "daily" ? day : Math.floor(day / 7);
  return ((period % count) + count) % count;
}

function canDefer(
  item: TrackedKeywordPortfolioItem,
  swapIns: Set<string>
): boolean {
  if (item.status !== "rank_without_demand" && item.status !== "low_priority") {
    return false;
  }
  if (!item.inLocalPack || item.packFragile) return false;
  if (item.matchedImpressions != null && item.matchedImpressions > 0) return false;
  if (swapIns.has(normalize(item.keyword))) return false;
  return true;
}

/**
 * Use GBP demand as a scheduling signal only. Rank remains sourced from Places,
 * and every deferred term rotates back into a live scan.
 */
export function planKeywordRankScans(input: {
  keywords: string[];
  audit: Phase1AuditPayload | null;
  targetDate: string;
  context: RankScanContext;
  enabled: boolean;
  minLiveScans: number;
}): KeywordRankScanPlan {
  const keywords = [...new Set(input.keywords.map(normalize).filter(Boolean))];
  const searchKeywords = input.audit?.gbp.performance.searchKeywords ?? [];
  const gbpDemandAvailable = searchKeywords.length > 0;

  if (!input.enabled || !input.audit || !gbpDemandAvailable) {
    return {
      liveScan: keywords,
      deferred: [],
      forcedRescan: [],
      gbpDemandAvailable,
    };
  }

  const portfolio: KeywordPortfolioAnalysis =
    input.audit.keywordPortfolio ?? computeKeywordPortfolio(input.audit);
  const byKeyword = new Map(
    portfolio.tracked.map((item) => [normalize(item.keyword), item])
  );
  const swapIns = new Set(
    portfolio.recommendedSwaps.map((swap) => normalize(swap.swapIn))
  );
  const eligible = keywords
    .map((keyword) => byKeyword.get(keyword))
    .filter((item): item is TrackedKeywordPortfolioItem =>
      Boolean(item && canDefer(item, swapIns))
    );

  if (eligible.length === 0) {
    return {
      liveScan: keywords,
      deferred: [],
      forcedRescan: [],
      gbpDemandAvailable,
    };
  }

  const forcedCount = 1;
  const forcedStart = rotationIndex(
    input.targetDate,
    input.context,
    eligible.length
  );
  const forced = Array.from(
    { length: Math.min(forcedCount, eligible.length) },
    (_, index) => eligible[(forcedStart + index) % eligible.length]
  );
  const live = new Set(
    keywords.filter((keyword) => {
      const item = byKeyword.get(keyword);
      return !item || !canDefer(item, swapIns);
    })
  );
  for (const item of forced) {
    live.add(normalize(item.keyword));
  }

  for (const keyword of keywords) {
    if (live.size >= Math.min(input.minLiveScans, keywords.length)) break;
    live.add(keyword);
  }

  const deferred = eligible
    .filter((item) => !live.has(normalize(item.keyword)))
    .map((item) => ({
      keyword: normalize(item.keyword),
      reason:
        "Google reports no measurable demand and the business is stably in the Local Pack; carrying forward the prior rank.",
      prior: item,
    }));

  return {
    liveScan: keywords.filter((keyword) => live.has(keyword)),
    deferred,
    forcedRescan: forced.map((item) => normalize(item.keyword)),
    gbpDemandAvailable,
  };
}
