import type { GbpOptimizationPlan, GbpPlanStep, Phase1AuditPayload } from "@/audit/types";
import {
  resolveForcedPlanStepNumbers,
  type PlanStepCandidate,
} from "@/audit/phase2/plan-candidates";
import { isStepSatisfied } from "@/audit/phase2/counterfactual";
import { orderGbpPlanStepsByImpact, planStepImpactScore } from "@/audit/phase2/gbp-plan";
import type { AttributionCalibration } from "@/audit/phase2/attribution-calibration";
import { KEYWORD_PORTFOLIO_PLAN_STEP } from "@/audit/phase2/keyword-portfolio";
import { resolvePlanStepAction } from "@/audit/phase3/gbp-plan-actions";
import { CUSTOM_PLAN_STEP_START } from "@/audit/phase3/plan-custom-steps";

const VALID_GBP_ACTIONS = new Set([
  "update_primary_category",
  "add_secondary_categories",
  "update_description",
  "add_service_items",
  "upload_photo",
  "upload_video",
  "update_attributes",
  "update_website",
  "create_post",
  "manual",
]);

/** Custom LLM actions start at 18 — step 17 is reserved for keyword portfolio. */
const CUSTOM_ACTION_START = CUSTOM_PLAN_STEP_START;
const MAX_CUSTOM_ACTIONS = 3;
const RETIRED_PLAN_STEP = 16;

export interface LlmPlanStepSelection {
  stepNumber: number;
  title?: string;
  instruction?: string;
  current?: string;
  recommended?: string;
  bullets?: string[];
  copyBlocks?: Array<{ label: string; content: string }>;
  selectionRationale?: string;
  gbpAction?: string;
  actionData?: GbpPlanStep["actionData"];
}

export interface LlmCustomPlanAction {
  title: string;
  instruction: string;
  rationale: string;
  gbpAction?: string;
  current?: string;
  recommended?: string;
  bullets?: string[];
  copyBlocks?: Array<{ label: string; content: string }>;
}

export interface LlmGbpPlanResponse {
  title?: string;
  objective?: string;
  planRationale?: string;
  selectedSteps?: LlmPlanStepSelection[];
  customActions?: LlmCustomPlanAction[];
  steps?: LlmPlanStepSelection[];
  keywordPriority?: Array<{ rank: number; keyword: string; reason: string }>;
  weeklyCadence?: string[];
  monthlyCadence?: string[];
}

export interface MergeLlmGbpPlanOptions {
  avgCustomerValue?: number | null;
  calibration?: AttributionCalibration;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCopyBlockArray(
  value: unknown
): value is Array<{ label: string; content: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        typeof item.content === "string"
    )
  );
}

/** Standard selectable steps: 1–15 and keyword portfolio (17). Step 16 is retired. */
export function isSelectableGbpPlanStepNumber(stepNumber: number): boolean {
  if (stepNumber === RETIRED_PLAN_STEP) return false;
  if (stepNumber === KEYWORD_PORTFOLIO_PLAN_STEP) return true;
  return stepNumber >= 1 && stepNumber <= 15;
}

function validateStepSelection(value: unknown): LlmPlanStepSelection | null {
  if (!isRecord(value)) return null;
  const stepNumber = value.stepNumber;
  if (typeof stepNumber !== "number" || !isSelectableGbpPlanStepNumber(stepNumber)) {
    return null;
  }

  return {
    stepNumber,
    title: typeof value.title === "string" ? value.title : undefined,
    instruction: typeof value.instruction === "string" ? value.instruction : undefined,
    current: typeof value.current === "string" ? value.current : undefined,
    recommended: typeof value.recommended === "string" ? value.recommended : undefined,
    bullets: isStringArray(value.bullets) ? value.bullets : undefined,
    copyBlocks: isCopyBlockArray(value.copyBlocks) ? value.copyBlocks : undefined,
    selectionRationale:
      typeof value.selectionRationale === "string" ? value.selectionRationale : undefined,
    gbpAction: typeof value.gbpAction === "string" ? value.gbpAction : undefined,
    actionData: isRecord(value.actionData)
      ? (value.actionData as GbpPlanStep["actionData"])
      : undefined,
  };
}

export function validateCustomAction(value: unknown): LlmCustomPlanAction | null {
  if (!isRecord(value)) return null;
  if (typeof value.title !== "string" || value.title.trim().length < 3) return null;
  if (typeof value.instruction !== "string" || value.instruction.trim().length < 10) return null;
  if (typeof value.rationale !== "string" || value.rationale.trim().length < 10) return null;
  if (
    value.gbpAction != null &&
    (typeof value.gbpAction !== "string" || !VALID_GBP_ACTIONS.has(value.gbpAction))
  ) {
    return null;
  }

  return {
    title: value.title.trim(),
    instruction: value.instruction.trim(),
    rationale: value.rationale.trim(),
    gbpAction: typeof value.gbpAction === "string" ? value.gbpAction : undefined,
    current: typeof value.current === "string" ? value.current : undefined,
    recommended: typeof value.recommended === "string" ? value.recommended : undefined,
    bullets: isStringArray(value.bullets) ? value.bullets : undefined,
    copyBlocks: isCopyBlockArray(value.copyBlocks) ? value.copyBlocks : undefined,
  };
}

export function validateLlmGbpPlanResponse(value: unknown): LlmGbpPlanResponse | null {
  if (!isRecord(value)) return null;

  const rawSteps = value.selectedSteps ?? value.steps;
  if (!Array.isArray(rawSteps)) return null;

  const selectedSteps = rawSteps
    .map(validateStepSelection)
    .filter((step): step is LlmPlanStepSelection => step != null);

  const seen = new Set<number>();
  const uniqueSteps = selectedSteps.filter((step) => {
    if (seen.has(step.stepNumber)) return false;
    seen.add(step.stepNumber);
    return true;
  });

  if (uniqueSteps.length < 3) return null;

  const customActions = Array.isArray(value.customActions)
    ? value.customActions
        .map(validateCustomAction)
        .filter((action): action is LlmCustomPlanAction => action != null)
        .slice(0, MAX_CUSTOM_ACTIONS)
    : [];

  return {
    title: typeof value.title === "string" ? value.title : undefined,
    objective: typeof value.objective === "string" ? value.objective : undefined,
    planRationale: typeof value.planRationale === "string" ? value.planRationale : undefined,
    selectedSteps: uniqueSteps,
    customActions,
    keywordPriority: Array.isArray(value.keywordPriority)
      ? value.keywordPriority.filter(
          (item) =>
            isRecord(item) &&
            typeof item.rank === "number" &&
            typeof item.keyword === "string" &&
            typeof item.reason === "string"
        )
      : undefined,
    weeklyCadence: isStringArray(value.weeklyCadence) ? value.weeklyCadence : undefined,
    monthlyCadence: isStringArray(value.monthlyCadence) ? value.monthlyCadence : undefined,
  };
}

function mergeSelectedStep(
  selection: LlmPlanStepSelection,
  templateStep: GbpPlanStep
): GbpPlanStep {
  const merged: GbpPlanStep = {
    stepNumber: selection.stepNumber,
    title: selection.title ?? templateStep.title,
    instruction: selection.instruction ?? templateStep.instruction,
    current: selection.current ?? templateStep.current,
    recommended: selection.recommended ?? templateStep.recommended,
    bullets: selection.bullets ?? templateStep.bullets,
    copyBlocks: selection.copyBlocks ?? templateStep.copyBlocks,
    actionData: selection.actionData ?? templateStep.actionData,
    gbpAction: resolvePlanStepAction(
      {
        stepNumber: selection.stepNumber,
        title: selection.title ?? templateStep.title,
        instruction: selection.instruction ?? templateStep.instruction,
        gbpAction: selection.gbpAction as GbpPlanStep["gbpAction"],
      },
      templateStep
    ),
  };

  if (selection.selectionRationale) {
    merged.instruction = `${merged.instruction}\n\nWhy this step: ${selection.selectionRationale}`;
  }

  return merged;
}

function customActionToStep(
  action: LlmCustomPlanAction,
  stepNumber: number
): GbpPlanStep {
  return {
    stepNumber,
    title: action.title,
    instruction: `${action.instruction}\n\nWhy this step: ${action.rationale}`,
    current: action.current,
    recommended: action.recommended,
    bullets: action.bullets,
    copyBlocks: action.copyBlocks,
    gbpAction:
      action.gbpAction && VALID_GBP_ACTIONS.has(action.gbpAction)
        ? (action.gbpAction as GbpPlanStep["gbpAction"])
        : "manual",
  };
}

function stampDisplayOrder(steps: GbpPlanStep[]): GbpPlanStep[] {
  return steps.map((step, index) => ({ ...step, displayOrder: index }));
}

/** Merge validated LLM selections onto deterministic template steps. */
export function mergeLlmGbpPlan(
  fallback: GbpOptimizationPlan,
  llm: LlmGbpPlanResponse,
  candidates: PlanStepCandidate[],
  audit: Phase1AuditPayload,
  options: MergeLlmGbpPlanOptions = {}
): GbpOptimizationPlan {
  const candidateByStep = new Map(candidates.map((c) => [c.stepNumber, c]));
  const avgCustomerValue = options.avgCustomerValue;
  const calibration = options.calibration;
  const standardSteps: GbpPlanStep[] = [];

  for (const selection of llm.selectedSteps ?? []) {
    if (isStepSatisfied(audit, selection.stepNumber)) {
      continue;
    }
    const candidate = candidateByStep.get(selection.stepNumber);
    if (!candidate) continue;
    standardSteps.push(mergeSelectedStep(selection, candidate.templateStep));
  }

  // Force portfolio / rank-outside-pack / conversion / inventory — same classes as reconcile.
  for (const stepNumber of resolveForcedPlanStepNumbers(audit, candidates)) {
    if (standardSteps.some((step) => step.stepNumber === stepNumber)) continue;
    const candidate = candidateByStep.get(stepNumber);
    if (!candidate) continue;
    standardSteps.push(candidate.templateStep);
  }

  // Deterministic impact order is source of truth; LLM provides copy, not final ranking.
  const orderedStandard = orderGbpPlanStepsByImpact(
    audit,
    standardSteps,
    avgCustomerValue,
    calibration
  );

  const customSteps: GbpPlanStep[] = [];
  let customStepNumber = CUSTOM_ACTION_START;
  for (const action of llm.customActions ?? []) {
    customSteps.push(customActionToStep(action, customStepNumber));
    customStepNumber += 1;
  }

  // Customs append after impact-ranked standard steps (no simulated impacts yet).
  const steps = stampDisplayOrder([...orderedStandard, ...customSteps]);

  if (steps.length < 3) {
    return fallback;
  }

  return {
    ...fallback,
    title: llm.title || fallback.title,
    objective: llm.objective || fallback.objective,
    planRationale: llm.planRationale || fallback.planRationale,
    steps,
    keywordPriority:
      llm.keywordPriority && llm.keywordPriority.length > 0
        ? llm.keywordPriority
        : fallback.keywordPriority,
    weeklyCadence:
      llm.weeklyCadence && llm.weeklyCadence.length > 0
        ? llm.weeklyCadence
        : fallback.weeklyCadence,
    monthlyCadence:
      llm.monthlyCadence && llm.monthlyCadence.length > 0
        ? llm.monthlyCadence
        : fallback.monthlyCadence,
    contentSource: "llm",
  };
}

/** Exported for tests — composite score used when ranking merged steps. */
export function mergeStepImpactScore(
  audit: Phase1AuditPayload,
  stepNumber: number,
  avgCustomerValue?: number | null,
  calibration?: AttributionCalibration
): number {
  return planStepImpactScore(audit, stepNumber, avgCustomerValue, calibration);
}
