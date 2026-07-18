import type { FullAuditPayload, Phase1AuditPayload, Plan, PlanStep } from "../types";
import { keywordsTargetedByStep, keywordNeedsOutcomeWork } from "./counterfactual";
import { detectPackFragility } from "./scoring";
import { computeKeywordScores } from "./keyword-scores";
import { detectGaps } from "./gaps";
import { CONVERSION_GAP_IDS } from "./conversion-constants";

const CONVERSION_GAP_ID_SET = new Set<string>(CONVERSION_GAP_IDS);

/** Local detector to avoid conversion-boost ↔ gaps ↔ counterfactual cycles. */
function needsConversionBoost(audit: Phase1AuditPayload): boolean {
  return detectGaps(audit).some((gap) => CONVERSION_GAP_ID_SET.has(gap.id));
}

/** Rank-family levers when a keyword is outside the local pack. */
const OUTSIDE_PACK_LEVERS = [5, 4, 3, 8, 10] as const;
/** Defend / strengthen when pack presence is fragile at wider radii. */
const PACK_FRAGILE_LEVERS = [8, 6, 10, 3] as const;
/** Convert existing views when the listing is visible but under-acting. */
const CONVERSION_LEVERS = [15, 8, 13, 11] as const;
/** Default defend levers when already in pack and converting. */
const DEFEND_LEVERS = [8, 10, 3] as const;

export interface KeywordActionBinding {
  keyword: string;
  inLocalPack: boolean;
  packFragile: boolean;
  /** Best unfinished-or-planned step for this keyword. */
  primaryStep: number;
  supportingSteps: number[];
  rationale: string;
}

export interface KeywordBindingOptions {
  avgCustomerValue?: number | null;
  /** When set, prefer primary steps that appear in this unfinished set. */
  unfinishedStepNumbers?: ReadonlySet<number>;
}

function uniqueSteps(steps: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const step of steps) {
    if (seen.has(step)) continue;
    seen.add(step);
    out.push(step);
  }
  return out;
}

function leverPoolForKeyword(
  audit: Phase1AuditPayload,
  inLocalPack: boolean,
  packFragile: boolean
): number[] {
  if (!inLocalPack) return [...OUTSIDE_PACK_LEVERS];
  if (packFragile) return [...PACK_FRAGILE_LEVERS];
  if (needsConversionBoost(audit)) return [...CONVERSION_LEVERS];
  return [...DEFEND_LEVERS];
}

function rationaleForKeyword(
  keyword: string,
  inLocalPack: boolean,
  packFragile: boolean,
  primaryStep: number,
  conversionBoost: boolean
): string {
  if (!inLocalPack) {
    return `"${keyword}" is outside the 3-Pack — start with step ${primaryStep}.`;
  }
  if (packFragile) {
    return `"${keyword}" is pack-fragile at wider radii — reinforce with step ${primaryStep}.`;
  }
  if (conversionBoost) {
    return `"${keyword}" is visible — convert views into calls/directions via step ${primaryStep}.`;
  }
  return `Defend "${keyword}" with step ${primaryStep}.`;
}

/**
 * Build per-keyword primary/supporting plan steps.
 * Diversifies primaryStep across keywords when multiple share the same lever pool.
 */
export function buildKeywordActionBindings(
  audit: Phase1AuditPayload,
  options: KeywordBindingOptions = {}
): KeywordActionBinding[] {
  const conversionBoost = needsConversionBoost(audit);
  const unfinished = options.unfinishedStepNumbers;
  const claimedPrimaries = new Set<number>();

  const scored = computeKeywordScores(audit, {
    avgCustomerValue: options.avgCustomerValue,
  });
  const scoreByKeyword = new Map(
    scored.map((card) => [card.keyword.toLowerCase(), card])
  );

  const ordered = [...audit.rankings.keywords].sort((a, b) => {
    const aNeeds = keywordNeedsOutcomeWork(a) ? 1 : 0;
    const bNeeds = keywordNeedsOutcomeWork(b) ? 1 : 0;
    if (bNeeds !== aNeeds) return bNeeds - aNeeds;
    const aGap =
      scoreByKeyword.get(a.keyword.toLowerCase())?.potentialAtRank1 != null &&
      scoreByKeyword.get(a.keyword.toLowerCase())?.estimatedMonthlyRevenue != null
        ? (scoreByKeyword.get(a.keyword.toLowerCase())!.potentialAtRank1 ?? 0) -
          (scoreByKeyword.get(a.keyword.toLowerCase())!.estimatedMonthlyRevenue ?? 0)
        : 0;
    const bGap =
      scoreByKeyword.get(b.keyword.toLowerCase())?.potentialAtRank1 != null &&
      scoreByKeyword.get(b.keyword.toLowerCase())?.estimatedMonthlyRevenue != null
        ? (scoreByKeyword.get(b.keyword.toLowerCase())!.potentialAtRank1 ?? 0) -
          (scoreByKeyword.get(b.keyword.toLowerCase())!.estimatedMonthlyRevenue ?? 0)
        : 0;
    if (bGap !== aGap) return bGap - aGap;
    return a.keyword.localeCompare(b.keyword);
  });

  return ordered.map((kw) => {
    const packFragile = detectPackFragility(kw).fragile;
    const pool = uniqueSteps(leverPoolForKeyword(audit, kw.inLocalPack, packFragile));
    const usable = unfinished
      ? pool.filter((step) => unfinished.has(step))
      : pool;
    const candidates = usable.length > 0 ? usable : pool;

    let primaryStep =
      candidates.find((step) => !claimedPrimaries.has(step)) ?? candidates[0] ?? pool[0] ?? 8;
    claimedPrimaries.add(primaryStep);

    const supportingSteps = pool.filter((step) => step !== primaryStep);
    return {
      keyword: kw.keyword,
      inLocalPack: kw.inLocalPack,
      packFragile,
      primaryStep,
      supportingSteps,
      rationale: rationaleForKeyword(
        kw.keyword,
        kw.inLocalPack,
        packFragile,
        primaryStep,
        conversionBoost
      ),
    };
  });
}

/** Keywords this step should claim in Plan UI / task payloads. */
export function resolveStepTargetKeywords(
  audit: Phase1AuditPayload,
  stepNumber: number
): string[] {
  const targeted = keywordsTargetedByStep(audit, stepNumber);
  if (targeted.length > 0) return targeted;
  return audit.rankings.keywords.map((k) => k.keyword);
}

/**
 * Primary keyword for a step: prefer keywords that bind this step as primary,
 * else supporting, else first targeted keyword.
 */
export function resolveStepPrimaryKeyword(
  audit: Phase1AuditPayload,
  stepNumber: number,
  options: KeywordBindingOptions = {}
): string | undefined {
  const targets = resolveStepTargetKeywords(audit, stepNumber);
  if (targets.length === 0) return undefined;

  const targetSet = new Set(targets.map((k) => k.toLowerCase()));
  const bindings = buildKeywordActionBindings(audit, options);

  const asPrimary = bindings.find(
    (b) => b.primaryStep === stepNumber && targetSet.has(b.keyword.toLowerCase())
  );
  if (asPrimary) return asPrimary.keyword;

  const asSupporting = bindings.find(
    (b) =>
      b.supportingSteps.includes(stepNumber) && targetSet.has(b.keyword.toLowerCase())
  );
  if (asSupporting) return asSupporting.keyword;

  return targets[0];
}

const ACTIONABLE: ReadonlySet<PlanStep["status"]> = new Set([
  "pending",
  "needs_approval",
  "approved",
]);

function stepImpactScore(step: PlanStep): number {
  return (
    (step.context.revenueImpact ?? 0) * 1000 +
    (step.context.leadsImpact ?? 0) * 50 +
    (step.context.engagementImpact ?? 0) * 10 +
    (step.context.outcomeScoreImpact ?? 0) * 10 +
    (step.context.healthScoreImpact ?? 0)
  );
}

function stepMentionsKeyword(step: PlanStep, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  if (step.context.primaryKeyword?.toLowerCase() === needle) return true;
  return step.context.targetKeywords.some((kw) => kw.toLowerCase() === needle);
}

/**
 * Best unfinished plan step to open for a keyword (Keyword Priority deep-link).
 * Prefers binding.primaryStep, then supporting bindings, then highest-impact mention.
 */
export function resolveBestPlanStepForKeyword(
  audit: Phase1AuditPayload,
  plan: Plan,
  keyword: string,
  options: KeywordBindingOptions = {}
): number | undefined {
  const unfinished = plan.steps.filter(
    (step) =>
      ACTIONABLE.has(step.status) &&
      step.stepNumber !== 0 &&
      stepMentionsKeyword(step, keyword)
  );
  if (unfinished.length === 0) {
    // Binding may point at a step not yet in curated plan — fall back to any unfinished
    // step that lists the keyword after rebuilding unfinished set from binding alone.
    const bindings = buildKeywordActionBindings(audit, {
      ...options,
      unfinishedStepNumbers: new Set(
        plan.steps
          .filter((s) => ACTIONABLE.has(s.status) && s.stepNumber !== 0)
          .map((s) => s.stepNumber)
      ),
    });
    const binding = bindings.find(
      (b) => b.keyword.toLowerCase() === keyword.toLowerCase()
    );
    if (!binding) return undefined;
    const byNumber = new Map(
      plan.steps
        .filter((s) => ACTIONABLE.has(s.status) && s.stepNumber !== 0)
        .map((s) => [s.stepNumber, s])
    );
    if (byNumber.has(binding.primaryStep)) return binding.primaryStep;
    for (const stepNumber of binding.supportingSteps) {
      if (byNumber.has(stepNumber)) return stepNumber;
    }
    return undefined;
  }

  const unfinishedNumbers = new Set(unfinished.map((s) => s.stepNumber));
  const bindings = buildKeywordActionBindings(audit, {
    ...options,
    unfinishedStepNumbers: unfinishedNumbers,
  });
  const binding = bindings.find(
    (b) => b.keyword.toLowerCase() === keyword.toLowerCase()
  );

  if (binding) {
    const primary = unfinished.find((s) => s.stepNumber === binding.primaryStep);
    if (primary) return primary.stepNumber;
    for (const stepNumber of binding.supportingSteps) {
      const hit = unfinished.find((s) => s.stepNumber === stepNumber);
      if (hit) return hit.stepNumber;
    }
  }

  return [...unfinished].sort((a, b) => stepImpactScore(b) - stepImpactScore(a))[0]
    ?.stepNumber;
}

export interface KeywordPlaybookSupportingStep {
  stepNumber: number;
  title: string;
}

/** UI model for “win this keyword” playbooks on the Plan tab. */
export interface KeywordPlaybook {
  keyword: string;
  rank: number;
  inLocalPack: boolean;
  packFragile: boolean;
  positionLabel: string;
  impressions: number | null;
  revenueGap: number | null;
  primaryStep: number | null;
  primaryStepTitle: string | null;
  ctaLabel: string;
  rationale: string;
  supportingSteps: KeywordPlaybookSupportingStep[];
}

export function ctaLabelForPlanStep(stepNumber: number, title?: string | null): string {
  switch (stepNumber) {
    case 3:
      return "Rewrite description";
    case 4:
    case 5:
      return "Add GBP services";
    case 6:
      return "Add coverage photos";
    case 7:
      return "Add a service video";
    case 8:
      return "Publish CTA post";
    case 10:
      return "Request reviews";
    case 11:
      return "Respond to reviews";
    case 13:
      return "Enable attributes";
    case 15:
      return "Add booking links";
    default:
      return title ? `Open: ${title}` : "Open step";
  }
}

export interface KeywordPlaybookOptions extends KeywordBindingOptions {
  /** Max playbooks to return (default 3). */
  limit?: number;
}

/**
 * Top keyword playbooks for Plan first viewport: position, gap, one primary CTA,
 * and supporting unfinished steps for “More for this keyword”.
 */
export function buildKeywordPlaybooks(
  audit: Phase1AuditPayload | FullAuditPayload,
  plan: Plan,
  options: KeywordPlaybookOptions = {}
): KeywordPlaybook[] {
  const limit = options.limit ?? 3;
  const scores = computeKeywordScores(audit, {
    avgCustomerValue: options.avgCustomerValue,
  });
  const scoreByKeyword = new Map(
    scores.map((card) => [card.keyword.toLowerCase(), card])
  );
  const strategy = "strategy" in audit ? audit.strategy : undefined;
  const rankings = strategy?.gbpPlan?.keywordRankings ?? [];
  const rankingByKeyword = new Map(
    rankings.map((row) => [row.keyword.toLowerCase(), row])
  );
  const priorities = strategy?.gbpPlan?.keywordPriority ?? [];

  const unfinishedSteps = plan.steps.filter(
    (step) => ACTIONABLE.has(step.status) && step.stepNumber !== 0
  );
  const unfinishedByNumber = new Map(
    unfinishedSteps.map((step) => [step.stepNumber, step])
  );
  const bindings = buildKeywordActionBindings(audit, {
    ...options,
    unfinishedStepNumbers: new Set(unfinishedByNumber.keys()),
  });
  const bindingByKeyword = new Map(
    bindings.map((binding) => [binding.keyword.toLowerCase(), binding])
  );

  const orderedKeywords =
    priorities.length > 0
      ? priorities.map((item) => item.keyword)
      : bindings.map((binding) => binding.keyword);

  const seen = new Set<string>();
  const playbooks: KeywordPlaybook[] = [];

  for (const keyword of orderedKeywords) {
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const ranking = rankingByKeyword.get(key);
    const score = scoreByKeyword.get(key);
    const binding = bindingByKeyword.get(key);
    const primaryStep =
      resolveBestPlanStepForKeyword(audit, plan, keyword, options) ?? null;
    const primaryCard = primaryStep != null ? unfinishedByNumber.get(primaryStep) : undefined;
    const supportingSteps: KeywordPlaybookSupportingStep[] = [];
    if (binding) {
      for (const stepNumber of binding.supportingSteps) {
        if (stepNumber === primaryStep) continue;
        const card = unfinishedByNumber.get(stepNumber);
        if (!card) continue;
        supportingSteps.push({ stepNumber, title: card.title });
        if (supportingSteps.length >= 3) break;
      }
    }

    const inLocalPack = ranking?.inLocalPack ?? score?.inLocalPack ?? false;
    const packFragile = ranking?.packFragile ?? binding?.packFragile ?? false;
    const positionLabel =
      ranking?.position ??
      score?.positionLabel ??
      (inLocalPack ? "In 3-Pack" : "Outside 3-Pack");

    playbooks.push({
      keyword,
      rank: playbooks.length + 1,
      inLocalPack,
      packFragile,
      positionLabel,
      impressions: score?.impressions ?? null,
      revenueGap:
        score?.potentialAtRank1 != null && score?.estimatedMonthlyRevenue != null
          ? Math.max(0, score.potentialAtRank1 - score.estimatedMonthlyRevenue)
          : null,
      primaryStep,
      primaryStepTitle: primaryCard?.title ?? null,
      ctaLabel:
        primaryStep != null
          ? ctaLabelForPlanStep(primaryStep, primaryCard?.title)
          : "View plan",
      rationale:
        binding?.rationale ??
        priorities.find((item) => item.keyword.toLowerCase() === key)?.reason ??
        `Win “${keyword}” for more profile views, calls, and directions.`,
      supportingSteps,
    });

    if (playbooks.length >= limit) break;
  }

  return playbooks;
}
