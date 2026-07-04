import type { FullAuditPayload, GapFlag, KeywordRankSnapshot, Phase1AuditPayload } from "../types";
import { computeGbpCompletenessScore } from "../completeness";
import {
  inferRecommendedSecondaryCategories,
  missingKeywordsForServices,
} from "./gbp-current-state";
import { resolveKeywordRelevance } from "./relevance-heuristic";
import { computeHealthScores } from "./scoring";
import type { AttributionCalibration } from "./attribution-calibration";
import { computeKeywordScores } from "./keyword-scores";

const PHOTO_TARGET = 60;
const POST_FRESH_DAYS = 14;
const RESPONSE_RATE_TARGET = 0.85;
const DESCRIPTION_MIN_LENGTH = 400;
const DEFAULT_RANK_IMPROVEMENT = 2;
const CUSTOM_PLAN_STEP_START = 17;

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function textContainsKeyword(text: string, keyword: string): boolean {
  const words = keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const lower = text.toLowerCase();
  if (words.length === 0) return lower.includes(keyword.toLowerCase());
  return words.some((w) => lower.includes(w));
}

function cityFromAddress(address: string): string {
  const parts = address.split(",");
  return parts.length > 1 ? parts[parts.length - 2]?.trim() ?? "your area" : "your area";
}

function targetKeywords(audit: Phase1AuditPayload): string[] {
  return audit.rankings.keywords.map((k) => k.keyword);
}

function ensureLiveProfile(audit: Phase1AuditPayload): void {
  if (!audit.gbp.liveProfile) {
    audit.gbp.liveProfile = {
      description: audit.gbp.identity.primaryCategory,
      primaryCategory: audit.gbp.identity.primaryCategory,
      secondaryCategories: [...audit.gbp.identity.secondaryCategories],
      services: [],
      attributes: [],
      source: "places",
    };
  }
}

function buildOptimizedDescription(audit: Phase1AuditPayload): string {
  const city = cityFromAddress(audit.gbp.identity.address);
  const kwList = targetKeywords(audit).join(", ");
  const category = audit.gbp.identity.primaryCategory;
  const reviews = audit.gbp.engagement.reviewCount;
  const rating = audit.gbp.engagement.averageRating;

  return `${audit.clientName} provides professional ${category} throughout ${city} and surrounding areas. We specialize in ${kwList}. With ${reviews}+ Google reviews (${rating}★), ${audit.clientName} delivers reliable service, clean vehicles, punctual arrivals, and professional staff. Call ${audit.gbp.identity.phone} for 24/7 availability.`;
}

function bumpCompleteness(audit: Phase1AuditPayload): void {
  const { gbp } = audit;
  gbp.completeness.completenessScore = computeGbpCompletenessScore({
    hasHours: gbp.completeness.hasHours,
    hasFullWeekHours: gbp.completeness.hasFullWeekHours,
    hasHolidayHours: gbp.completeness.hasHolidayHours,
    hasDescription: gbp.completeness.hasDescription,
    descriptionLength: gbp.completeness.descriptionLength,
    hasServices: gbp.completeness.hasServices,
    serviceCount: gbp.completeness.serviceCount,
    attributeCount: gbp.completeness.attributeCount,
    hasPhotos: gbp.content.photoCount > 0,
    hasWebsite: Boolean(gbp.identity.website),
    noPendingEdits: gbp.completeness.noPendingEdits,
  });
}

function clearRelevanceCache(audit: Phase1AuditPayload): void {
  delete audit.keywordRelevance;
}

export function cloneAudit<T extends Phase1AuditPayload>(audit: T): T {
  return structuredClone(audit);
}

/** Whether a GBP plan step area is already in good shape for this business. */
export function isStepSatisfied(audit: Phase1AuditPayload, stepNumber: number): boolean {
  const { gbp, reviews } = audit;
  const keywords = targetKeywords(audit);

  switch (stepNumber) {
    case 1:
      return resolveKeywordRelevance(audit).every((r) => r.categoryFit >= 75);
    case 2: {
      const recommended = inferRecommendedSecondaryCategories(audit).filter(
        (c) => !c.toLowerCase().includes("keep as primary")
      );
      if (recommended.length === 0) return true;
      const existing = new Set(
        (gbp.liveProfile?.secondaryCategories ?? gbp.identity.secondaryCategories).map((c) =>
          c.toLowerCase()
        )
      );
      return recommended.every((c) => existing.has(c.toLowerCase()));
    }
    case 3: {
      const desc = gbp.liveProfile?.description ?? "";
      return (
        desc.length >= DESCRIPTION_MIN_LENGTH &&
        keywords.every((kw) => textContainsKeyword(desc, kw))
      );
    }
    case 4:
      return missingKeywordsForServices(audit).length === 0;
    case 5:
      return audit.rankings.keywords.every((k) => k.inLocalPack);
    case 6:
      return gbp.content.photoCount >= PHOTO_TARGET;
    case 7:
      return gbp.content.videoCount >= 2;
    case 8:
      return daysSince(gbp.content.lastPostDate) <= POST_FRESH_DAYS;
    case 9:
      return gbp.content.unansweredQa === 0;
    case 10: {
      const hasReviewGap = audit.rankings.keywords.some(
        (k) => k.inLocalPack && k.clientReviewCount < k.packLeaderReviewCount * 0.5
      );
      const reviewTarget = Math.max(200, gbp.engagement.reviewCount + 50);
      return !hasReviewGap && gbp.engagement.reviewCount >= reviewTarget * 0.8;
    }
    case 11:
      return (
        reviews.unrespondedNegative === 0 &&
        gbp.engagement.responseRate >= RESPONSE_RATE_TARGET
      );
    case 12:
      return (
        gbp.completeness.hasHours &&
        gbp.completeness.hasFullWeekHours &&
        gbp.completeness.hasHolidayHours
      );
    case 13:
      return gbp.completeness.attributeCount >= 5;
    case 14:
    case 15:
      return false;
    case 16:
      return false;
    default:
      return false;
  }
}

/** Apply the audit-input changes that completing this plan step would represent. */
export function applyStepMutation(audit: Phase1AuditPayload, stepNumber: number): void {
  clearRelevanceCache(audit);
  const keywords = targetKeywords(audit);

  switch (stepNumber) {
    case 1: {
      ensureLiveProfile(audit);
      const lowFit = resolveKeywordRelevance(audit).filter((r) => r.categoryFit < 75);
      const secondary = new Set(
        (audit.gbp.liveProfile!.secondaryCategories ?? []).map((c) => c.toLowerCase())
      );
      for (const rel of lowFit) {
        const token = rel.keyword.split(/\s+/).find((w) => w.length > 3);
        if (token && !secondary.has(token)) {
          audit.gbp.liveProfile!.secondaryCategories.push(
            `${token.charAt(0).toUpperCase()}${token.slice(1)} service`
          );
          secondary.add(token);
        }
      }
      break;
    }
    case 2: {
      ensureLiveProfile(audit);
      const recommended = inferRecommendedSecondaryCategories(audit).filter(
        (c) => !c.toLowerCase().includes("keep as primary")
      );
      const existing = new Set(
        audit.gbp.liveProfile!.secondaryCategories.map((c) => c.toLowerCase())
      );
      for (const category of recommended) {
        if (!existing.has(category.toLowerCase())) {
          audit.gbp.liveProfile!.secondaryCategories.push(category);
          existing.add(category.toLowerCase());
        }
      }
      bumpCompleteness(audit);
      break;
    }
    case 3: {
      ensureLiveProfile(audit);
      audit.gbp.liveProfile!.description = buildOptimizedDescription(audit);
      audit.gbp.completeness.descriptionLength = audit.gbp.liveProfile!.description.length;
      audit.gbp.completeness.hasDescription = true;
      bumpCompleteness(audit);
      break;
    }
    case 4: {
      ensureLiveProfile(audit);
      const missing = missingKeywordsForServices(audit);
      const toAdd = missing.length > 0 ? missing : keywords;
      const city = cityFromAddress(audit.gbp.identity.address);
      for (const kw of toAdd) {
        audit.gbp.liveProfile!.services.push({
          name: kw,
          description: `Professional ${kw} in ${city}.`,
        });
      }
      audit.gbp.completeness.serviceCount = audit.gbp.liveProfile!.services.length;
      audit.gbp.completeness.hasServices = true;
      bumpCompleteness(audit);
      break;
    }
    case 5:
      break;
    case 6:
      audit.gbp.content.photoCount = Math.max(
        PHOTO_TARGET,
        audit.gbp.content.photoCount,
        Math.max(200, audit.gbp.content.photoCount + 80)
      );
      bumpCompleteness(audit);
      break;
    case 7:
      audit.gbp.content.videoCount = Math.max(2, audit.gbp.content.videoCount);
      break;
    case 8:
      audit.gbp.content.lastPostDate = new Date().toISOString();
      audit.gbp.content.postCount = Math.max(1, audit.gbp.content.postCount);
      break;
    case 9:
      audit.gbp.content.unansweredQa = 0;
      audit.gbp.content.qaCount = Math.max(audit.gbp.content.qaCount, 15);
      break;
    case 10: {
      const avgLeader =
        audit.rankings.keywords.reduce((s, k) => s + k.packLeaderReviewCount, 0) /
        Math.max(audit.rankings.keywords.length, 1);
      const reviewTarget = Math.max(200, audit.gbp.engagement.reviewCount + 50, avgLeader * 0.8);
      audit.gbp.engagement.reviewCount = Math.round(
        Math.max(audit.gbp.engagement.reviewCount, reviewTarget)
      );
      break;
    }
    case 11:
      audit.reviews.unrespondedNegative = 0;
      audit.gbp.engagement.responseRate = 1;
      break;
    case 12:
      audit.gbp.completeness.hasHolidayHours = true;
      audit.gbp.completeness.hasHours = true;
      audit.gbp.completeness.hasFullWeekHours = true;
      bumpCompleteness(audit);
      break;
    case 13:
      audit.gbp.completeness.attributeCount = Math.max(5, audit.gbp.completeness.attributeCount);
      ensureLiveProfile(audit);
      if (audit.gbp.liveProfile!.attributes.length < 5) {
        audit.gbp.liveProfile!.attributes.push(
          "Online appointments",
          "Wheelchair accessible",
          "Accepts credit cards"
        );
      }
      bumpCompleteness(audit);
      break;
    case 14:
    case 15:
      break;
    case 16: {
      applyStepMutation(audit, 6);
      applyStepMutation(audit, 8);
      applyStepMutation(audit, 11);
      break;
    }
    default:
      break;
  }
}

/** Apply audit-input changes that closing this gap would represent. */
export function applyGapMutation(audit: Phase1AuditPayload, gap: GapFlag): void {
  if (gap.id.startsWith("rank-outside-pack")) return;

  if (gap.id.startsWith("relevance-gap-")) {
    const keyword = gap.id.replace("relevance-gap-", "");
    ensureLiveProfile(audit);
    const desc = audit.gbp.liveProfile!.description ?? "";
    if (!textContainsKeyword(desc, keyword)) {
      audit.gbp.liveProfile!.description = `${desc} We specialize in ${keyword}.`.trim();
      audit.gbp.completeness.descriptionLength = audit.gbp.liveProfile!.description.length;
    }
    const services = audit.gbp.liveProfile!.services ?? [];
    if (!services.some((s) => textContainsKeyword(s.name, keyword))) {
      audit.gbp.liveProfile!.services.push({
        name: keyword,
        description: `Professional ${keyword} services.`,
      });
    }
    clearRelevanceCache(audit);
    return;
  }

  if (gap.id.startsWith("review-gap-")) {
    const kw = audit.rankings.keywords.find((k) => gap.id === `review-gap-${k.keyword}`);
    if (kw) {
      audit.gbp.engagement.reviewCount = Math.max(
        audit.gbp.engagement.reviewCount,
        Math.round(kw.packLeaderReviewCount * 0.55)
      );
    }
    return;
  }

  switch (gap.id) {
    case "stale-posts":
      audit.gbp.content.lastPostDate = new Date().toISOString();
      break;
    case "low-photos":
      audit.gbp.content.photoCount = Math.max(PHOTO_TARGET, audit.gbp.content.photoCount);
      break;
    case "missing-holiday-hours":
      audit.gbp.completeness.hasHolidayHours = true;
      bumpCompleteness(audit);
      break;
    case "missing-hours":
      audit.gbp.completeness.hasHours = true;
      audit.gbp.completeness.hasFullWeekHours = true;
      bumpCompleteness(audit);
      break;
    case "incomplete-week-hours":
      audit.gbp.completeness.hasFullWeekHours = true;
      bumpCompleteness(audit);
      break;
    case "low-attributes":
      audit.gbp.completeness.attributeCount = Math.max(5, audit.gbp.completeness.attributeCount);
      bumpCompleteness(audit);
      break;
    case "google-pending-edits":
    case "google-suggested-edits":
      audit.gbp.completeness.noPendingEdits = true;
      audit.gbp.googleSuggestions = [];
      bumpCompleteness(audit);
      break;
    case "unresponded-negative":
      audit.reviews.unrespondedNegative = 0;
      break;
    case "low-response-rate":
      audit.gbp.engagement.responseRate = 1;
      break;
    case "unanswered-qa":
      audit.gbp.content.unansweredQa = 0;
      break;
    default:
      break;
  }
}

/** Marginal driver-score gain from completing one plan step, via computeHealthScores(). */
export function simulateStepDriverImpact(
  audit: Phase1AuditPayload,
  stepNumber: number
): number {
  if (isStepSatisfied(audit, stepNumber)) return 0;

  const before = computeHealthScores(audit).driverScore;
  const mutated = cloneAudit(audit);
  applyStepMutation(mutated, stepNumber);
  const after = computeHealthScores(mutated).driverScore;
  return Math.max(0, after - before);
}

/** Marginal driver-score gain from closing one gap, via computeHealthScores(). */
export function simulateGapDriverImpact(audit: Phase1AuditPayload, gap: GapFlag): number {
  if (gap.id.startsWith("rank-outside-pack")) return 0;

  const before = computeHealthScores(audit).driverScore;
  const mutated = cloneAudit(audit);
  applyGapMutation(mutated, gap);
  const after = computeHealthScores(mutated).driverScore;
  return Math.max(0, after - before);
}

export interface ProjectedHealthScores {
  projectedDriverScore: number;
  projectedOverallScore: number;
  driverGain: number;
  overallGain: number;
}

export interface ProjectedOutcomeScores {
  projectedOutcomeIndex: number;
  projectedVisibility: number;
  projectedRevenueCapture: number;
  projectedOverallScore: number;
  outcomeGain: number;
  visibilityGain: number;
  revenueCaptureGain: number;
  overallGain: number;
  estimatedMonthlyRevenue: number | null;
  revenueGain: number | null;
}

export interface CounterfactualProjectionOptions {
  calibration?: AttributionCalibration;
  avgCustomerValue?: number | null;
}

export interface ActionRef {
  source: "plan" | "gap";
  id: string;
}

function numericRankAtOneMile(kw: KeywordRankSnapshot): number {
  const rank1mi = kw.geoRanks.find((g) => g.distanceMiles === 1)?.rank;
  if (rank1mi != null) return rank1mi;
  if (typeof kw.localPackPosition === "number") return kw.localPackPosition;
  return 20;
}

function improveKeywordRank(kw: KeywordRankSnapshot, rankDelta: number): KeywordRankSnapshot {
  const current = numericRankAtOneMile(kw);
  const improved = Math.max(1, current - rankDelta);
  const inLocalPack = improved <= 3;
  const localPackPosition = inLocalPack
    ? (improved as 1 | 2 | 3)
    : ("not_in_pack" as const);

  return {
    ...kw,
    inLocalPack,
    localPackPosition,
    geoRanks: kw.geoRanks.map((g) =>
      g.distanceMiles === 1 ? { ...g, rank: improved, inLocalPack } : g
    ),
  };
}

function refreshRankingAggregates(audit: Phase1AuditPayload): void {
  audit.rankings.keywordsInPack = audit.rankings.keywords.filter((k) => k.inLocalPack).length;
  audit.rankings.shareOfVoice = audit.rankings.keywords.length
    ? Math.round((audit.rankings.keywordsInPack / audit.rankings.keywords.length) * 100)
    : 0;
}

function rankDeltaForStep(
  stepNumber: number,
  calibration?: AttributionCalibration
): number {
  const cal = calibration?.[stepNumber];
  if (cal?.medianRankDelta != null && cal.medianRankDelta > 0) {
    return Math.min(5, Math.max(1, Math.round(cal.medianRankDelta)));
  }

  switch (stepNumber) {
    case 3:
    case 4:
    case 8:
      return 2;
    case 10:
    case 11:
    case 6:
    case 7:
      return 1;
    default:
      return DEFAULT_RANK_IMPROVEMENT;
  }
}

function keywordsTargetedByStep(audit: Phase1AuditPayload, stepNumber: number): string[] {
  const keywords = audit.rankings.keywords;
  const outsidePack = keywords.filter((k) => !k.inLocalPack).map((k) => k.keyword);

  switch (stepNumber) {
    case 3:
    case 4:
    case 8:
      return outsidePack.length > 0 ? outsidePack : keywords.map((k) => k.keyword);
    case 5:
      return outsidePack;
    case 10:
    case 11:
      return keywords
        .filter((k) => !k.inLocalPack || k.localPackPosition === 3)
        .map((k) => k.keyword);
    case 6:
    case 7:
      return outsidePack.slice(0, 2);
    default:
      return outsidePack.slice(0, 1);
  }
}

function totalEstimatedRevenue(
  audit: Phase1AuditPayload,
  avgCustomerValue?: number | null
): number | null {
  if (!avgCustomerValue || avgCustomerValue <= 0) return null;

  const cards = computeKeywordScores(audit, { avgCustomerValue });
  let sum = 0;
  let any = false;
  for (const card of cards) {
    if (card.estimatedMonthlyRevenue != null) {
      sum += card.estimatedMonthlyRevenue;
      any = true;
    }
  }
  return any ? sum : null;
}

/** Apply projected rank improvements for keywords a plan step would influence. */
export function applyOutcomeMutation(
  audit: Phase1AuditPayload,
  stepNumber: number,
  calibration?: AttributionCalibration
): void {
  if (stepNumber >= CUSTOM_PLAN_STEP_START) return;
  if (isStepSatisfied(audit, stepNumber)) return;

  const rankDelta = rankDeltaForStep(stepNumber, calibration);
  const targets = new Set(
    keywordsTargetedByStep(audit, stepNumber).map((keyword) => keyword.toLowerCase())
  );
  if (targets.size === 0) return;

  audit.rankings.keywords = audit.rankings.keywords.map((kw) =>
    targets.has(kw.keyword.toLowerCase()) ? improveKeywordRank(kw, rankDelta) : kw
  );
  refreshRankingAggregates(audit);
}

/** Apply projected rank improvements for rank-outside-pack gaps. */
export function applyOutcomeGapMutation(audit: Phase1AuditPayload, gap: GapFlag): void {
  if (!gap.id.startsWith("rank-outside-pack-")) return;

  const keyword = gap.id.replace("rank-outside-pack-", "");
  audit.rankings.keywords = audit.rankings.keywords.map((kw) => {
    if (kw.keyword.toLowerCase() !== keyword.toLowerCase()) return kw;
    const delta = Math.max(3, numericRankAtOneMile(kw) - 3);
    return improveKeywordRank(kw, delta);
  });
  refreshRankingAggregates(audit);
}

function applyActionMutations(
  audit: Phase1AuditPayload,
  action: ActionRef,
  options?: CounterfactualProjectionOptions
): void {
  if (action.source === "plan") {
    const match = action.id.match(/^gbp-step-(\d+)$/);
    if (!match) return;
    const stepNumber = Number(match[1]);
    applyStepMutation(audit, stepNumber);
    applyOutcomeMutation(audit, stepNumber, options?.calibration);
    return;
  }

  const gap = { id: action.id } as GapFlag;
  applyGapMutation(audit, gap);
  applyOutcomeGapMutation(audit, gap);
}

/** Re-run scoring after applying a set of plan steps and/or gaps. */
export function projectHealthScoresFromActions(
  audit: Phase1AuditPayload,
  actions: Array<{ source: "plan" | "gap"; id: string }>,
  options?: CounterfactualProjectionOptions
): ProjectedHealthScores {
  const before = computeHealthScores(audit);
  const mutated = cloneAudit(audit);

  for (const action of actions) {
    applyActionMutations(mutated, action, options);
  }

  const after = computeHealthScores(mutated);
  return {
    projectedDriverScore: after.driverScore,
    projectedOverallScore: after.overall,
    driverGain: after.driverScore - before.driverScore,
    overallGain: after.overall - before.overall,
  };
}

/** Project ranking outcome and revenue after applying profile + rank counterfactuals. */
export function projectOutcomeScoresFromActions(
  audit: Phase1AuditPayload,
  actions: ActionRef[],
  options: CounterfactualProjectionOptions = {}
): ProjectedOutcomeScores {
  const before = computeHealthScores(audit);
  const beforeRevenue = totalEstimatedRevenue(audit, options.avgCustomerValue);
  const mutated = cloneAudit(audit);

  for (const action of actions) {
    applyActionMutations(mutated, action, options);
  }

  const after = computeHealthScores(mutated);
  const afterRevenue = totalEstimatedRevenue(mutated, options.avgCustomerValue);

  return {
    projectedOutcomeIndex: after.outcomeIndex,
    projectedVisibility: after.visibility,
    projectedRevenueCapture: after.revenueCapture,
    projectedOverallScore: after.overall,
    outcomeGain: after.outcomeIndex - before.outcomeIndex,
    visibilityGain: after.visibility - before.visibility,
    revenueCaptureGain: after.revenueCapture - before.revenueCapture,
    overallGain: after.overall - before.overall,
    estimatedMonthlyRevenue: afterRevenue,
    revenueGain:
      beforeRevenue != null && afterRevenue != null
        ? Math.max(0, afterRevenue - beforeRevenue)
        : null,
  };
}

/** Convenience wrapper for path-to-healthy and plan progress. */
export function projectHealthScoresFromStepNumbers(
  audit: FullAuditPayload,
  stepNumbers: number[],
  options?: CounterfactualProjectionOptions
): ProjectedHealthScores {
  return projectHealthScoresFromActions(
    audit,
    stepNumbers.map((n) => ({ source: "plan" as const, id: `gbp-step-${n}` })),
    options
  );
}

export interface SelectedAction extends ActionRef {
  marginalDriverGain: number;
}

/**
 * Greedily pick actions until cumulative driver gain meets the target.
 * Uses full counterfactual re-scoring at each pick — avoids double-counting
 * overlapping steps (e.g. description + services both moving relevance).
 */
export function pickActionsForDriverTarget(
  audit: Phase1AuditPayload,
  candidates: ActionRef[],
  pointsNeeded: number,
  options?: CounterfactualProjectionOptions
): { selected: SelectedAction[]; projection: ProjectedHealthScores } {
  const selected: SelectedAction[] = [];
  const remaining = [...candidates];
  let currentProjection = projectHealthScoresFromActions(audit, [], options);

  while (currentProjection.driverGain < pointsNeeded && remaining.length > 0) {
    let bestIndex = -1;
    let bestMarginal = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const withCandidate = projectHealthScoresFromActions(audit, [...selected, candidate], options);
      const marginal = withCandidate.driverGain - currentProjection.driverGain;
      if (marginal > bestMarginal) {
        bestMarginal = marginal;
        bestIndex = i;
      }
    }

    if (bestIndex < 0 || bestMarginal <= 0) break;

    const picked = remaining.splice(bestIndex, 1)[0];
    selected.push({ ...picked, marginalDriverGain: bestMarginal });
    currentProjection = projectHealthScoresFromActions(audit, selected, options);
  }

  return { selected, projection: currentProjection };
}
