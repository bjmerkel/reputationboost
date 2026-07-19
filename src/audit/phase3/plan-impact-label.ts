import type { PlanStep } from "../types";
import { formatCurrency } from "../attribution/roi";
import { isConversionPlanStep } from "../phase2/conversion-constants";
import { isCustomPlanStep } from "./plan-custom-steps";

/** Round lead counts for display (whole numbers at 10+, one decimal below). */
export function roundLeadCount(leads: number): number {
  if (!Number.isFinite(leads)) return 0;
  return leads >= 10 ? Math.round(leads) : Math.round(leads * 10) / 10;
}

/** Format a lead count for Plan UI (keeps one decimal under 10). */
export function formatLeadsMo(leads: number): string {
  return `${roundLeadCount(leads)} leads/mo`;
}

/** Parenthetical suffix for ACV preview copy, e.g. " (+2 leads/mo)". */
export function formatLeadGainSuffix(leadGain: number | null | undefined): string {
  if (leadGain == null || leadGain <= 0) return "";
  const rounded = roundLeadCount(leadGain);
  if (rounded <= 0) return "";
  return ` (+${rounded} leads/mo)`;
}

/** Format profile actions (calls + directions + website clicks) for Plan UI. */
export function formatActionsMo(actions: number): string {
  const rounded = actions >= 10 ? Math.round(actions) : Math.round(actions * 10) / 10;
  return `${rounded} actions/mo`;
}

export interface PlanStepImpactLabels {
  primary: string | null;
  secondary: string | null;
}

function estimateQualifier(
  confidence: PlanStep["context"]["projectionConfidence"]
): "model est." | "early signal est." | "est." {
  if (confidence === "high" || confidence === "medium") return "est.";
  if (confidence === "low") return "early signal est.";
  return "model est.";
}

/** Short qualitative line for custom LLM steps (no fabricated $/leads). */
export function formatCustomPlanStepSignal(step: PlanStep): string | null {
  if (!isCustomPlanStep(step.stepNumber)) return null;
  if (step.context.selectionRationale?.trim()) {
    const rationale = step.context.selectionRationale.trim();
    return rationale.length > 90 ? `${rationale.slice(0, 87)}…` : rationale;
  }
  if (step.context.expectedEffect?.trim()) {
    return step.context.expectedEffect.trim();
  }
  return "Custom strategist action — follow the expected effect";
}

/** Prefer $/mo when ACV is set; otherwise leads, engagement actions, then score pts. */
export function formatPlanStepImpactLabel(
  step: PlanStep,
  currency = "USD"
): string | null {
  return formatPlanStepImpactLabels(step, currency).primary;
}

function revenueLabel(
  amount: number,
  currency: string,
  qualifier: "model est." | "early signal est." | "est."
): string {
  return `+${formatCurrency(amount, currency)}/mo ${qualifier}`;
}

function rankingPtsLabel(points: number): string {
  return `+${points} ranking pts`;
}

function scorePtsLabel(points: number): string {
  return `+${points} score pts`;
}

/** Primary + secondary impact lines for step cards (outcome-first for conversion steps). */
export function formatPlanStepImpactLabels(
  step: PlanStep,
  currency = "USD"
): PlanStepImpactLabels {
  const qualifier = estimateQualifier(step.context.projectionConfidence);
  const custom = formatCustomPlanStepSignal(step);
  const revenue = step.context.revenueImpact ?? 0;
  const leads = step.context.leadsImpact ?? 0;
  const engagement = step.context.engagementImpact ?? 0;
  const outcome = step.context.outcomeScoreImpact ?? 0;
  const health = step.context.healthScoreImpact ?? 0;

  if (isConversionPlanStep(step.stepNumber)) {
    let primary: string | null = null;
    if (revenue > 0) primary = revenueLabel(revenue, currency, qualifier);
    else if (leads > 0) primary = `+${formatLeadsMo(leads)} ${qualifier}`;
    else if (engagement > 0) primary = `+${engagement} actions/mo ${qualifier}`;
    else if (custom) primary = custom;

    let secondary: string | null = null;
    if (outcome > 0) secondary = rankingPtsLabel(outcome);
    else if (health > 0 && primary) secondary = scorePtsLabel(health);

    return { primary, secondary };
  }

  let primary: string | null = null;
  if (revenue > 0) primary = revenueLabel(revenue, currency, qualifier);
  else if (outcome > 0) primary = rankingPtsLabel(outcome);
  else if (leads > 0) primary = `+${formatLeadsMo(leads)} ${qualifier}`;
  else if (engagement > 0) primary = `+${engagement} actions/mo ${qualifier}`;
  else if (health > 0) primary = scorePtsLabel(health);
  else if (custom) primary = custom;

  let secondary: string | null = null;
  if (primary && revenue > 0 && outcome > 0) secondary = rankingPtsLabel(outcome);
  else if (primary && revenue > 0 && engagement > 0) {
    secondary = `+${engagement} actions/mo ${qualifier}`;
  } else if (primary && outcome > 0 && health > 0) secondary = scorePtsLabel(health);

  return { primary, secondary };
}
