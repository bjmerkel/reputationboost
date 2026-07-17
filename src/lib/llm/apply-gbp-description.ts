import type { FullAuditPayload, GbpOptimizationPlan, GbpPlanStep } from "@/audit/types";
import { sanitizeGbpDescriptionDraft } from "@/lib/google/gbp-description";
import { looksLikeKeywordStuffedDescription } from "@/lib/google/gbp-description-draft";
import type { AuditGeneratedContent } from "./content";

const DESCRIPTION_COPY_LABEL = "Recommended description (paste into GBP)";

function planDescriptionText(step: GbpPlanStep | undefined): string {
  if (!step) return "";
  return String(step.actionData?.description ?? step.copyBlocks?.[0]?.content ?? "").trim();
}

function withDescriptionOnStep(step: GbpPlanStep, description: string): GbpPlanStep {
  return {
    ...step,
    recommended: "Updated description below — includes all target keywords",
    copyBlocks: [{ label: DESCRIPTION_COPY_LABEL, content: description }],
    actionData: {
      ...(step.actionData ?? {}),
      description,
    },
  };
}

/** Whether generated content should overwrite the plan/task description draft. */
export function shouldApplyGeneratedDescription(
  existingDescription: string,
  content: AuditGeneratedContent
): boolean {
  const next = sanitizeGbpDescriptionDraft(content.gbpDescription ?? "").trim();
  if (!next) return false;

  const existing = existingDescription.trim();
  if (!existing) return true;
  if (sanitizeGbpDescriptionDraft(existing) === next) return false;

  // LLM content writer owns description copy when configured successfully.
  if (content.contentSource === "llm") return true;

  // Template fallback may still replace legacy keyword-stuffed drafts.
  return looksLikeKeywordStuffedDescription(existing);
}

export function applyGeneratedDescriptionToPlan(
  plan: GbpOptimizationPlan,
  content: AuditGeneratedContent
): GbpOptimizationPlan {
  const description = sanitizeGbpDescriptionDraft(content.gbpDescription ?? "").trim();
  if (!description) return plan;

  let changed = false;
  const steps = plan.steps.map((step) => {
    if (step.stepNumber !== 3) return step;
    if (!shouldApplyGeneratedDescription(planDescriptionText(step), content)) {
      return step;
    }
    changed = true;
    return withDescriptionOnStep(step, description);
  });

  return changed ? { ...plan, steps } : plan;
}

/** Persist generated description onto plan step 3 so Plan UI matches task drafts. */
export function applyGeneratedDescriptionToAudit(
  audit: FullAuditPayload,
  content: AuditGeneratedContent
): FullAuditPayload {
  const plan = audit.strategy.gbpPlan;
  if (!plan) return audit;

  const nextPlan = applyGeneratedDescriptionToPlan(plan, content);
  if (nextPlan === plan) return audit;

  return {
    ...audit,
    strategy: {
      ...audit.strategy,
      gbpPlan: nextPlan,
    },
  };
}

/** Resolve the paste-ready description for an update_description plan task. */
export function resolveGbpDescriptionDraft(
  step: GbpPlanStep,
  content: AuditGeneratedContent,
  actionDescription?: string
): string {
  const fromPlan = String(
    actionDescription ?? step.actionData?.description ?? step.copyBlocks?.[0]?.content ?? ""
  ).trim();
  const fromContent = sanitizeGbpDescriptionDraft(content.gbpDescription ?? "").trim();

  if (content.contentSource === "llm" && fromContent) {
    return fromContent;
  }

  if (fromPlan && !looksLikeKeywordStuffedDescription(fromPlan)) {
    return sanitizeGbpDescriptionDraft(fromPlan);
  }

  if (fromContent) {
    return fromContent;
  }

  return sanitizeGbpDescriptionDraft(fromPlan);
}
