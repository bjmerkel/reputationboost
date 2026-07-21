export type AutopilotMode = "off" | "manual" | "suggest" | "auto";

export type ExperimentOrigin = "manual" | "suggested" | "auto";

export const AUTOPILOT_MODE_LABELS: Record<AutopilotMode, string> = {
  off: "Off",
  manual: "Manual",
  suggest: "Suggest",
  auto: "Auto-queue",
};

export const AUTOPILOT_MODE_DESCRIPTIONS: Record<AutopilotMode, string> = {
  off: "Hide autopilot features for this business.",
  manual: "You choose cells and actions on the map.",
  suggest: "Nightly suggestions appear here for approval — nothing runs until you approve.",
  auto: "Nightly job queues the best cell + action for approval automatically.",
};

export function parseAutopilotMode(value: unknown): AutopilotMode {
  if (value === "off" || value === "manual" || value === "suggest" || value === "auto") {
    return value;
  }
  return "manual";
}

export function modeCreatesExecutionTask(mode: AutopilotMode): boolean {
  return mode === "manual" || mode === "auto";
}

export function modeRunsNightlyProposals(mode: AutopilotMode): boolean {
  return mode === "suggest" || mode === "auto";
}

export function modeShowsAutopilotUi(mode: AutopilotMode): boolean {
  return mode !== "off";
}
