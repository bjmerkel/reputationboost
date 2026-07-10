import type {
  ClientConfig,
  KeywordPortfolioAnalysis,
  KeywordPortfolioStatus,
  KeywordRankSnapshot,
  KeywordSwapRecommendation,
  Phase1AuditPayload,
  StrategyReport,
  TrackedKeywordPortfolioItem,
  UntrackedGbpKeywordCandidate,
} from "../types";
import { SEARCH_RADII_MILES } from "@/lib/google/places";
import {
  computeHealthScores,
  detectPackFragility,
  keywordServiceAreaVisibilityScore,
  matchSearchKeywordImpressions,
} from "./scoring";
import { radiusWeightsForAudit } from "./radius-profiles";
import { relevanceByKeyword } from "./relevance-heuristic";

const MIN_KEYWORDS = 3;
const MAX_KEYWORDS = 8;
const MAX_SWAPS_PER_CYCLE = 3;

type GbpSearchKeyword = {
  keyword: string;
  impressions: number | null;
  belowThreshold: boolean;
};

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

/** Reverse match: which tracked keyword best covers a GBP search term. */
export function findTrackedKeywordForGbpTerm(
  gbpTerm: string,
  trackedKeywords: string[]
): string | null {
  const gbpLower = gbpTerm.toLowerCase();
  let bestQuality = -1;
  let bestKeyword: string | null = null;

  for (const tracked of trackedKeywords) {
    const trackedLower = tracked.toLowerCase();
    let quality: number;
    if (trackedLower === gbpLower) {
      quality = 10_000 + trackedLower.length;
    } else if (trackedLower.includes(gbpLower)) {
      quality = gbpLower.length;
    } else if (gbpLower.includes(trackedLower)) {
      quality = trackedLower.length;
    } else {
      continue;
    }

    if (quality > bestQuality) {
      bestQuality = quality;
      bestKeyword = tracked;
    }
  }

  return bestKeyword;
}

export function isBrandKeyword(
  keyword: string,
  businessName: string,
  city: string
): boolean {
  const kwLower = keyword.toLowerCase();
  const nameTokens = tokenize(businessName).filter((token) => token.length >= 4);
  const cityLower = city.trim().toLowerCase();

  if (cityLower && kwLower === cityLower) return true;
  if (cityLower && kwLower.includes(cityLower) && kwLower.split(/\s+/).length <= 3) {
    return true;
  }

  const matchedNameTokens = nameTokens.filter((token) => kwLower.includes(token));
  return matchedNameTokens.length >= 1 && matchedNameTokens.length >= nameTokens.length * 0.5;
}

function extractGeoTokens(keyword: string): string[] {
  return tokenize(keyword).filter(
    (token) => !["near", "best", "local", "emergency", "repair", "service", "services", "company", "contractor"].includes(token)
  );
}

function primaryBusinessCity(audit: Phase1AuditPayload): string {
  const address = audit.gbp.identity.address ?? "";
  const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}/);
  if (cityMatch?.[1]) return cityMatch[1].trim().toLowerCase();
  return "";
}

function keywordUsesDifferentCity(keyword: string, businessCity: string): boolean {
  if (!businessCity) return false;
  const geoTokens = extractGeoTokens(keyword);
  const cityToken = businessCity.toLowerCase();
  const hasOtherCity = geoTokens.some(
    (token) => token.length >= 4 && token !== cityToken && !cityToken.includes(token)
  );
  return hasOtherCity && !keyword.toLowerCase().includes(cityToken);
}

function classifyTrackedKeyword(
  kw: KeywordRankSnapshot,
  audit: Phase1AuditPayload,
  matchedImpressions: number | null,
  visibilityScore: number,
  relevanceScore: number
): KeywordPortfolioStatus {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];

  if (isBrandKeyword(kw.keyword, audit.clientName, primaryBusinessCity(audit))) {
    return "brand_anchor";
  }

  if (matchedImpressions != null && matchedImpressions > 0) {
    return "proven_demand";
  }

  const hasBelowThresholdMatch = searchKeywords.some((sk) => {
    if (!sk.belowThreshold) return false;
    return findTrackedKeywordForGbpTerm(sk.keyword, [kw.keyword]) != null;
  });
  if (hasBelowThresholdMatch) {
    return "proven_demand";
  }

  if (!kw.inLocalPack) {
    return "growth_target";
  }

  if (matchedImpressions == null || matchedImpressions <= 0) {
    if (visibilityScore >= 70) {
      return "rank_without_demand";
    }
    return "low_priority";
  }

  return "low_priority";
}

function swapOutPriority(
  item: TrackedKeywordPortfolioItem,
  audit: Phase1AuditPayload
): number {
  if (item.status === "brand_anchor" || item.status === "proven_demand") return -1;
  if (item.status === "growth_target") return 10;

  let score = 0;
  if (item.status === "rank_without_demand") score += 80;
  if (item.status === "low_priority") score += 40;
  if (item.inLocalPack) score += 25;
  if (item.visibilityScore >= 90) score += 20;
  if (item.matchedImpressions == null || item.matchedImpressions <= 0) score += 15;

  const businessCity = primaryBusinessCity(audit);
  if (keywordUsesDifferentCity(item.keyword, businessCity)) score += 30;

  return score;
}

const STREET_ADDRESS_RE =
  /\b\d{1,6}\s+\w+.*\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl)\b/i;
const BUSINESS_LISTING_RE = /[–—]| - .+\b(llc|inc|corp|company|roof|replacement|plumbing|hvac)\b/i;
const RESEARCH_QUERY_RE =
  /\b(how many|how much|how to|what is|why|when to|cost|costs|price|prices|salary|jobs|hiring|career|careers)\b/i;
const COMMON_SERVICE_SIGNAL_RE =
  /\b(repair|installation|install|service|services|contractor|plumber|plumbing|hvac|dentist|dental|lawyer|attorney|roofer|roofing|electrician|locksmith|chiropractor|restaurant|pizza|salon|barber|gym|daycare|day care|childcare|child care|preschool|nursery|kindergarten|school|learning|cleaning|mover|movers|towing|mechanic|vet|clinic|urgent care|montessori|ac|a\/c|air|heat|heating|cooling|furnace|boiler|duct|maintenance|replacement|emergency)\b/i;

function industryTokens(industry: string): string[] {
  return industry
    .toLowerCase()
    .replace(/\b(contractor|company|service|services|inc|llc|center|centers|learning)\b/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

/** Whether a term looks like a Maps find-a-business query for this industry. */
export function hasIndustryServiceIntent(term: string, industry: string): boolean {
  const normalized = normalizeKeyword(term);
  if (COMMON_SERVICE_SIGNAL_RE.test(normalized)) return true;
  const tokens = industryTokens(industry);
  return tokens.some((token) => normalized.includes(token));
}

/** Hard junk only — used when building the full pool for AI selection. */
export function isHardJunkGbpTerm(keyword: string): boolean {
  const term = normalizeKeyword(keyword);
  if (!term || term.length < 3) return true;
  if (STREET_ADDRESS_RE.test(term)) return true;
  if (BUSINESS_LISTING_RE.test(term)) return true;
  if (RESEARCH_QUERY_RE.test(term)) return true;
  if (/https?:\/\//.test(term)) return true;
  return false;
}

/** True when a GBP term is navigational/junk and should not be tracked as a rank keyword. */
export function isJunkTrackingKeyword(
  keyword: string,
  businessName: string,
  businessCity: string,
  industry = ""
): boolean {
  const term = normalizeKeyword(keyword);
  if (isHardJunkGbpTerm(term)) return true;

  const hasServiceIntent = hasIndustryServiceIntent(term, industry);
  // City / brand navigational queries without service intent are not rank keywords.
  if (!hasServiceIntent && isBrandKeyword(term, businessName, businessCity)) {
    return true;
  }
  if (!hasServiceIntent) {
    const tokens = tokenize(term);
    if (tokens.length <= 2) return true;
  }

  return false;
}

/** All GBP search terms not already covered by tracked keywords (minimal junk filter). */
export function listUntrackedGbpSearchTerms(audit: Phase1AuditPayload): GbpSearchKeyword[] {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const tracked = audit.rankings.keywords.map((keyword) => keyword.keyword);

  return searchKeywords.filter(
    (sk) =>
      !findTrackedKeywordForGbpTerm(sk.keyword, tracked) && !isHardJunkGbpTerm(sk.keyword)
  );
}

function expandGbpCandidate(gbpTerm: string, audit: Phase1AuditPayload): string[] {
  const industry = audit.gbp.identity.primaryCategory || audit.gbp.identity.name;
  const industryShort = industry.split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  const term = normalizeKeyword(gbpTerm);
  const businessCity = primaryBusinessCity(audit);
  const businessName = audit.clientName || audit.gbp.identity.name;
  const variants = new Set<string>();

  const rawIsJunk = isJunkTrackingKeyword(term, businessName, businessCity, industry);
  if (!rawIsJunk) {
    variants.add(term);
  }

  // Expand geo/brand navigational terms into one service+geo keyword (not both word orders).
  if (industryShort && term.split(/\s+/).length <= 2) {
    const geo = businessCity || term.replace(/,\s*/g, " ").trim();
    if (geo) {
      variants.add(normalizeKeyword(`${industryShort} ${geo}`));
    }
  }

  return [...variants].filter(
    (keyword) => !isJunkTrackingKeyword(keyword, businessName, businessCity, industry)
  );
}

function tokenSignature(keyword: string): string {
  return tokenize(keyword).sort().join(" ");
}

function addUntrackedCandidate(
  candidates: Map<string, UntrackedGbpKeywordCandidate>,
  sk: GbpSearchKeyword,
  keyword: string
): void {
  const impressions = sk.impressions ?? 0;
  const opportunityScore =
    impressions > 0
      ? impressions * 2
      : sk.belowThreshold
        ? 15
        : 5;

  const existing = candidates.get(keyword);
  if (!existing || opportunityScore > existing.opportunityScore) {
    candidates.set(keyword, {
      keyword,
      sourceGbpTerm: sk.keyword,
      impressions: sk.impressions,
      belowThreshold: sk.belowThreshold,
      opportunityScore,
      reason:
        impressions > 0
          ? `Google reports ${impressions} impressions for "${sk.keyword}" but you are not tracking it.`
          : sk.belowThreshold
            ? `"${sk.keyword}" appears in GBP search terms (below reporting threshold) and is not in your tracked set.`
            : `Untracked GBP search term "${sk.keyword}".`,
    });
  }
}

function buildUntrackedCandidates(audit: Phase1AuditPayload): UntrackedGbpKeywordCandidate[] {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const tracked = audit.rankings.keywords.map((k) => k.keyword);
  const trackedNormalized = new Set(tracked.map(normalizeKeyword));
  const trackedSignatures = new Set(tracked.map(tokenSignature));
  const businessCity = primaryBusinessCity(audit);
  const businessName = audit.clientName || audit.gbp.identity.name;
  const industry = audit.gbp.identity.primaryCategory || "";
  const candidates = new Map<string, UntrackedGbpKeywordCandidate>();
  const usedSignatures = new Set<string>();

  for (const sk of searchKeywords) {
    if (findTrackedKeywordForGbpTerm(sk.keyword, tracked)) continue;

    const rawTerm = normalizeKeyword(sk.keyword);
    if (
      !trackedNormalized.has(rawTerm) &&
      !isJunkTrackingKeyword(rawTerm, businessName, businessCity, industry)
    ) {
      const rawSignature = tokenSignature(rawTerm);
      if (!trackedSignatures.has(rawSignature)) {
        addUntrackedCandidate(candidates, sk, rawTerm);
      }
    }

    const expanded = expandGbpCandidate(sk.keyword, audit);
    for (const keyword of expanded) {
      if (trackedNormalized.has(keyword)) continue;
      if (isJunkTrackingKeyword(keyword, businessName, businessCity, industry)) continue;

      const signature = tokenSignature(keyword);
      if (trackedSignatures.has(signature)) continue;

      addUntrackedCandidate(candidates, sk, keyword);
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .filter((candidate) => {
      const signature = tokenSignature(candidate.keyword);
      if (usedSignatures.has(signature)) return false;
      usedSignatures.add(signature);
      return true;
    });
}

function analyzeTrackedKeywords(audit: Phase1AuditPayload): TrackedKeywordPortfolioItem[] {
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const relevanceMap = relevanceByKeyword(audit);
  const weights = radiusWeightsForAudit(audit);

  return audit.rankings.keywords.map((kw) => {
    const matchedImpressions = matchSearchKeywordImpressions(kw.keyword, searchKeywords);
    const visibilityScore = keywordServiceAreaVisibilityScore(kw, weights);
    const relevanceScore = relevanceMap.get(kw.keyword.toLowerCase())?.score ?? 50;
    const fragility = detectPackFragility(kw);
    const status = classifyTrackedKeyword(
      kw,
      audit,
      matchedImpressions,
      visibilityScore,
      relevanceScore
    );

    let reason = "";
    switch (status) {
      case "proven_demand":
        reason =
          matchedImpressions != null && matchedImpressions > 0
            ? `Driving ${matchedImpressions} reported impressions — keep tracking.`
            : "Matched to a GBP search term — keep tracking.";
        break;
      case "brand_anchor":
        reason = "Brand or navigational query — anchor term for your portfolio.";
        break;
      case "rank_without_demand":
        reason = `Strong pack position (#${kw.localPackPosition}) but no measurable search demand in Google’s keyword report.`;
        break;
      case "growth_target":
        reason = "Outside the Local 3-Pack — still worth ranking work.";
        break;
      default:
        reason = "Weak rank signal and no impression data.";
    }

    if (keywordUsesDifferentCity(kw.keyword, primaryBusinessCity(audit))) {
      reason += " Keyword targets a different city than your primary GBP address.";
    }

    return {
      keyword: kw.keyword,
      status,
      inLocalPack: kw.inLocalPack,
      localPackPosition: kw.localPackPosition,
      visibilityScore: Math.round(visibilityScore),
      relevanceScore,
      matchedImpressions,
      packFragile: fragility.fragile,
      reason,
    };
  });
}

function buildSwapRecommendations(
  audit: Phase1AuditPayload,
  tracked: TrackedKeywordPortfolioItem[],
  untracked: UntrackedGbpKeywordCandidate[]
): KeywordSwapRecommendation[] {
  const swaps: KeywordSwapRecommendation[] = [];
  const usedIns = new Set<string>();
  const usedOuts = new Set<string>();

  const swapOutCandidates = tracked
    .map((item) => ({ item, priority: swapOutPriority(item, audit) }))
    .filter((entry) => entry.priority >= 0)
    .sort((a, b) => b.priority - a.priority);

  const impressionBacked = untracked.filter((c) => (c.impressions ?? 0) > 0);
  const industry = audit.gbp.identity.primaryCategory || "";
  const serviceBelowThreshold = untracked.filter(
    (c) => (c.impressions ?? 0) <= 0 && hasIndustryServiceIntent(c.keyword, industry)
  );
  const rankedIns = [...impressionBacked, ...serviceBelowThreshold];

  for (const candidate of rankedIns) {
    if (swaps.length >= MAX_SWAPS_PER_CYCLE) break;
    if (usedIns.has(candidate.keyword)) continue;

    const swapOut = swapOutCandidates.find(
      (entry) => !usedOuts.has(entry.item.keyword) && entry.priority >= 40
    );
    if (!swapOut) break;

    usedIns.add(candidate.keyword);
    usedOuts.add(swapOut.item.keyword);

    swaps.push({
      swapOut: swapOut.item.keyword,
      swapIn: candidate.keyword,
      reason: `Replace rank-optimized "${swapOut.item.keyword}" with demand-backed "${candidate.keyword}".`,
      swapOutReason: swapOut.item.reason,
      swapInReason: candidate.reason,
      priority: Math.round(swapOut.priority + candidate.opportunityScore / 10),
      estimatedImpressionGain: candidate.impressions,
    });
  }

  return swaps.sort((a, b) => b.priority - a.priority);
}

function countDemandAligned(tracked: TrackedKeywordPortfolioItem[]): number {
  return tracked.filter(
    (item) => item.status === "proven_demand" || item.status === "brand_anchor"
  ).length;
}

/** Build an optimized keyword list from audit signals (does not persist). */
export function buildOptimizedKeywordList(
  audit: Phase1AuditPayload,
  currentKeywords: string[],
  precomputed?: Pick<
    KeywordPortfolioAnalysis,
    "tracked" | "recommendedSwaps" | "untrackedCandidates"
  >
): string[] {
  const analysis = precomputed ?? {
    tracked: analyzeTrackedKeywords(audit),
    recommendedSwaps: [] as KeywordSwapRecommendation[],
    untrackedCandidates: buildUntrackedCandidates(audit),
  };

  if (!precomputed) {
    analysis.recommendedSwaps = buildSwapRecommendations(
      audit,
      analysis.tracked,
      analysis.untrackedCandidates
    );
  }

  const swappedOut = new Set(
    analysis.recommendedSwaps.map((swap) => normalizeKeyword(swap.swapOut))
  );
  const result = new Set<string>();

  for (const item of analysis.tracked) {
    if (swappedOut.has(normalizeKeyword(item.keyword))) continue;
    if (item.status === "brand_anchor" || item.status === "proven_demand" || item.status === "growth_target") {
      result.add(item.keyword);
    }
  }

  for (const swap of analysis.recommendedSwaps) {
    result.add(swap.swapIn);
  }

  for (const candidate of analysis.untrackedCandidates) {
    if (result.size >= MAX_KEYWORDS) break;
    if (candidate.impressions != null && candidate.impressions > 0) {
      result.add(candidate.keyword);
    }
  }

  // Prefer remaining growth/low-priority tracked terms before re-adding swap-outs.
  const fillOrder = [
    ...analysis.tracked
      .filter((item) => !swappedOut.has(normalizeKeyword(item.keyword)))
      .filter((item) => item.status === "growth_target" || item.status === "low_priority")
      .map((item) => item.keyword),
    ...currentKeywords.filter((keyword) => !swappedOut.has(normalizeKeyword(keyword))),
  ];

  for (const keyword of fillOrder) {
    if (result.size >= MAX_KEYWORDS) break;
    result.add(keyword);
  }

  const list = [...result].slice(0, MAX_KEYWORDS);
  while (list.length < MIN_KEYWORDS) {
    const next = currentKeywords.find(
      (keyword) =>
        !list.some((existing) => normalizeKeyword(existing) === normalizeKeyword(keyword))
    );
    if (!next) break;
    list.push(next);
  }

  return list.map(normalizeKeyword);
}

/** Prioritize keywords for limited grid slots (weekly ingest, heatmaps). */
export function prioritizeKeywordsForGrid(
  audit: Phase1AuditPayload,
  keywords: string[],
  limit = 5
): string[] {
  const portfolio = computeKeywordPortfolio(audit);
  const byKeyword = new Map(portfolio.tracked.map((item) => [item.keyword.toLowerCase(), item]));
  const swapIns = new Set(portfolio.recommendedSwaps.map((swap) => swap.swapIn.toLowerCase()));
  const untrackedScores = new Map(
    portfolio.untrackedCandidates.map((candidate) => [
      candidate.keyword.toLowerCase(),
      candidate.opportunityScore,
    ])
  );

  const scored = keywords.map((keyword) => {
    const item = byKeyword.get(keyword.toLowerCase());
    let score = 0;

    if (item) {
      if (item.status === "growth_target") score += 100;
      if (item.status === "proven_demand") score += 80;
      if (item.status === "rank_without_demand") score += 20;
      if (item.packFragile) score += 60;
      if (!item.inLocalPack) score += 50;
      score += Math.max(0, 100 - item.visibilityScore);
    }

    if (swapIns.has(keyword.toLowerCase())) score += 90;
    score += untrackedScores.get(keyword.toLowerCase()) ?? 0;

    return { keyword, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.keyword);
}

export function computeKeywordPortfolio(audit: Phase1AuditPayload): KeywordPortfolioAnalysis {
  const tracked = analyzeTrackedKeywords(audit);
  const untrackedCandidates = buildUntrackedCandidates(audit);
  const recommendedSwaps = buildSwapRecommendations(audit, tracked, untrackedCandidates);
  const rankWithoutDemand = tracked.filter((item) => item.status === "rank_without_demand");
  const demandAlignedCount = countDemandAligned(tracked);
  const totalTracked = tracked.length;
  const demandAlignmentScore =
    totalTracked > 0 ? Math.round((demandAlignedCount / totalTracked) * 100) : 0;

  const currentKeywords = audit.rankings.keywords.map((k) => k.keyword);
  const recommendedKeywords = buildOptimizedKeywordList(audit, currentKeywords, {
    tracked,
    recommendedSwaps,
    untrackedCandidates,
  });

  let summary = "Tracked keywords align with Google search demand.";
  if (rankWithoutDemand.length > 0 && untrackedCandidates.length > 0) {
    summary = `${rankWithoutDemand.length} tracked keyword(s) rank well but show no impressions, while ${untrackedCandidates.length} GBP search term(s) are not tracked. Rotate toward demand-backed terms.`;
  } else if (rankWithoutDemand.length > 0) {
    summary = `${rankWithoutDemand.length} tracked keyword(s) are optimized for rankings but not receiving measurable search demand.`;
  } else if (untrackedCandidates.some((c) => c.impressions != null && c.impressions > 0)) {
    summary = "High-impression GBP search terms are missing from your tracked keyword set.";
  }

  const shouldRotate =
    recommendedSwaps.length > 0 &&
    demandAlignmentScore < 50 &&
    (rankWithoutDemand.length >= 2 || untrackedCandidates.some((c) => (c.impressions ?? 0) > 0));

  return {
    computedAt: new Date().toISOString(),
    demandAlignmentScore,
    rankWithoutDemandCount: rankWithoutDemand.length,
    untrackedDemandCount: untrackedCandidates.filter(
      (c) => (c.impressions ?? 0) > 0 || c.belowThreshold
    ).length,
    tracked,
    untrackedCandidates: untrackedCandidates.slice(0, 12),
    recommendedSwaps,
    recommendedKeywords,
    shouldRotate,
    summary,
  };
}

function refreshRankingAggregates(audit: Phase1AuditPayload): void {
  audit.rankings.totalKeywords = audit.rankings.keywords.length;
  audit.rankings.keywordsInPack = audit.rankings.keywords.filter((k) => k.inLocalPack).length;
  audit.rankings.shareOfVoice = audit.rankings.keywords.length
    ? Math.round((audit.rankings.keywordsInPack / audit.rankings.keywords.length) * 100)
    : 0;
}

function placeholderKeywordSnapshot(keyword: string, rank = 7): KeywordRankSnapshot {
  const inLocalPack = rank <= 3;
  return {
    keyword,
    localPackPosition: inLocalPack ? (rank as 1 | 2 | 3) : "not_in_pack",
    inLocalPack,
    geoRanks: SEARCH_RADII_MILES.map((distanceMiles) => ({
      distanceMiles,
      rank,
      inLocalPack: rank <= 3,
    })),
    packLeaderRating: 4.7,
    packLeaderReviewCount: 120,
    clientRating: 4.5,
    clientReviewCount: 40,
  };
}

/** Optimistically sync audit rankings to a newly saved tracked keyword list. */
export function applyTrackedKeywordsToAudit(
  audit: Phase1AuditPayload,
  keywords: string[]
): Phase1AuditPayload {
  const normalized = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length < MIN_KEYWORDS) return audit;

  const existingByKey = new Map(
    audit.rankings.keywords.map((item) => [item.keyword.toLowerCase(), item])
  );

  const next: Phase1AuditPayload = {
    ...audit,
    rankings: {
      ...audit.rankings,
      keywords: normalized.map((keyword) => {
        const existing = existingByKey.get(keyword);
        return existing ?? placeholderKeywordSnapshot(keyword, 7);
      }),
    },
  };
  refreshRankingAggregates(next);
  next.keywordPortfolio = computeKeywordPortfolio(next);

  const withStrategy = next as Phase1AuditPayload & { strategy?: StrategyReport };
  if (withStrategy.strategy) {
    withStrategy.strategy = {
      ...withStrategy.strategy,
      scores: computeHealthScores(next),
    };
  }

  return next;
}

export interface ApplyKeywordPortfolioOptions {
  /** Swap a single rank-without-demand keyword instead of the full portfolio. */
  swapOutKeyword?: string;
}

/** Counterfactual + plan simulation: align tracked keywords with portfolio recommendations. */
export function applyKeywordPortfolioToAudit(
  audit: Phase1AuditPayload,
  options: ApplyKeywordPortfolioOptions = {}
): void {
  const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
  audit.keywordPortfolio = portfolio;

  let targetKeywords = portfolio.recommendedKeywords;

  if (options.swapOutKeyword) {
    const swap = portfolio.recommendedSwaps.find(
      (item) => item.swapOut.toLowerCase() === options.swapOutKeyword!.toLowerCase()
    );
    if (!swap) return;

    targetKeywords = audit.rankings.keywords.map((item) => item.keyword);
    const index = targetKeywords.findIndex(
      (keyword) => keyword.toLowerCase() === swap.swapOut.toLowerCase()
    );
    if (index < 0) return;
    targetKeywords[index] = swap.swapIn;
  }

  if (targetKeywords.length < MIN_KEYWORDS) return;

  const existingByKey = new Map(
    audit.rankings.keywords.map((item) => [item.keyword.toLowerCase(), item])
  );
  const swapRankByKeyword = new Map(
    portfolio.recommendedSwaps.map((swap) => [swap.swapIn.toLowerCase(), 5])
  );

  audit.rankings.keywords = targetKeywords.map((keyword) => {
    const existing = existingByKey.get(keyword.toLowerCase());
    if (existing) return existing;
    const projectedRank = swapRankByKeyword.get(keyword.toLowerCase()) ?? 7;
    return placeholderKeywordSnapshot(keyword, projectedRank);
  });

  refreshRankingAggregates(audit);
  audit.keywordPortfolio = computeKeywordPortfolio(audit);
}

export function trackedKeywordsMatchRecommendations(audit: Phase1AuditPayload): boolean {
  const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
  const current = audit.rankings.keywords.map((item) => normalizeKeyword(item.keyword));
  const recommended = portfolio.recommendedKeywords.map((item) => normalizeKeyword(item));
  if (current.length === 0 || recommended.length === 0) return false;
  if (current.length !== recommended.length) return false;

  const currentSet = new Set(current);
  return recommended.every((keyword) => currentSet.has(keyword));
}

export function portfolioStepIsSatisfied(audit: Phase1AuditPayload): boolean {
  const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
  if (!portfolio.shouldRotate && portfolio.demandAlignmentScore >= 60) {
    return true;
  }

  return trackedKeywordsMatchRecommendations(audit);
}

export const KEYWORD_PORTFOLIO_PLAN_STEP = 17;

export function applyKeywordPortfolioToClient(
  client: ClientConfig,
  portfolio: KeywordPortfolioAnalysis
): ClientConfig {
  return {
    ...client,
    keywords: portfolio.recommendedKeywords,
  };
}
