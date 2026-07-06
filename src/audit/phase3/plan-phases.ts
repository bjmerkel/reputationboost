import type { PlanPhase, PlanPhaseId } from "../types";

const FOUNDATION_STEPS = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15];
const CONTENT_STEPS = [6, 7, 8, 9];
const REPUTATION_STEPS = [10, 11];
const ONGOING_STEPS = [16];

const STEP_TO_PHASE = new Map<number, PlanPhaseId>([
  ...FOUNDATION_STEPS.map((n) => [n, "foundation"] as const),
  ...CONTENT_STEPS.map((n) => [n, "content"] as const),
  ...REPUTATION_STEPS.map((n) => [n, "reputation"] as const),
  ...ONGOING_STEPS.map((n) => [n, "ongoing"] as const),
]);

export const PLAN_PHASE_DEFINITIONS: PlanPhase[] = [
  { id: "foundation", title: "Foundation", stepNumbers: FOUNDATION_STEPS },
  { id: "content", title: "Content engine", stepNumbers: CONTENT_STEPS },
  { id: "reputation", title: "Reputation", stepNumbers: REPUTATION_STEPS },
  { id: "ongoing", title: "Ongoing", stepNumbers: ONGOING_STEPS },
];

export function getPhaseForStep(stepNumber: number): PlanPhaseId {
  if (stepNumber === 0) return "foundation";
  if (stepNumber >= 17) return "ongoing";
  return STEP_TO_PHASE.get(stepNumber) ?? "foundation";
}
