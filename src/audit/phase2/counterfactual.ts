import type { FullAuditPayload, GapFlag, Phase1AuditPayload } from "../types";
import {
  inferRecommendedSecondaryCategories,
  missingKeywordsForServices,
} from "./gbp-current-state";
import { resolveKeywordRelevance } from "./relevance-heuristic";
import { computeHealthScores } from "./scoring";

const PHOTO_TARGET = 60;
const POST_FRESH_DAYS = 14;
const RESPONSE_RATE_TARGET = 0.85;
const DESCRIPTION_MIN_LENGTH = 400;

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

function bumpCompleteness(audit: Phase1AuditPayload, delta: number): void {
  audit.gbp.completeness.completenessScore = Math.min(
    100,
    audit.gbp.completeness.completenessScore + delta
  );
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
      return gbp.completeness.hasHours && gbp.completeness.hasHolidayHours;
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
      bumpCompleteness(audit, 3);
      break;
    }
    case 3: {
      ensureLiveProfile(audit);
      audit.gbp.liveProfile!.description = buildOptimizedDescription(audit);
      audit.gbp.completeness.descriptionLength = audit.gbp.liveProfile!.description.length;
      audit.gbp.completeness.hasDescription = true;
      bumpCompleteness(audit, 5);
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
      bumpCompleteness(audit, 5);
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
      bumpCompleteness(audit, 4);
      break;
    case 13:
      audit.gbp.completeness.attributeCount = Math.max(5, audit.gbp.completeness.attributeCount);
      ensureLiveProfile(audit);
      if (audit.gbp.liveProfile!.attributes.length < 3) {
        audit.gbp.liveProfile!.attributes.push("Online appointments");
      }
      bumpCompleteness(audit, 3);
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
      bumpCompleteness(audit, 4);
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

/** Re-run scoring after applying a set of plan steps and/or gaps. */
export function projectHealthScoresFromActions(
  audit: Phase1AuditPayload,
  actions: Array<{ source: "plan" | "gap"; id: string }>
): ProjectedHealthScores {
  const before = computeHealthScores(audit);
  const mutated = cloneAudit(audit);

  for (const action of actions) {
    if (action.source === "plan") {
      const match = action.id.match(/^gbp-step-(\d+)$/);
      if (match) applyStepMutation(mutated, Number(match[1]));
    } else {
      applyGapMutation(mutated, { id: action.id } as GapFlag);
    }
  }

  const after = computeHealthScores(mutated);
  return {
    projectedDriverScore: after.driverScore,
    projectedOverallScore: after.overall,
    driverGain: after.driverScore - before.driverScore,
    overallGain: after.overall - before.overall,
  };
}

/** Convenience wrapper for path-to-healthy and plan progress. */
export function projectHealthScoresFromStepNumbers(
  audit: FullAuditPayload,
  stepNumbers: number[]
): ProjectedHealthScores {
  return projectHealthScoresFromActions(
    audit,
    stepNumbers.map((n) => ({ source: "plan" as const, id: `gbp-step-${n}` }))
  );
}

export interface ActionRef {
  source: "plan" | "gap";
  id: string;
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
  pointsNeeded: number
): { selected: SelectedAction[]; projection: ProjectedHealthScores } {
  const selected: SelectedAction[] = [];
  const remaining = [...candidates];
  let currentProjection = projectHealthScoresFromActions(audit, []);

  while (currentProjection.driverGain < pointsNeeded && remaining.length > 0) {
    let bestIndex = -1;
    let bestMarginal = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const withCandidate = projectHealthScoresFromActions(audit, [
        ...selected,
        candidate,
      ]);
      const marginal = withCandidate.driverGain - currentProjection.driverGain;
      if (marginal > bestMarginal) {
        bestMarginal = marginal;
        bestIndex = i;
      }
    }

    if (bestIndex < 0 || bestMarginal <= 0) break;

    const picked = remaining.splice(bestIndex, 1)[0];
    selected.push({ ...picked, marginalDriverGain: bestMarginal });
    currentProjection = projectHealthScoresFromActions(audit, selected);
  }

  return { selected, projection: currentProjection };
}
