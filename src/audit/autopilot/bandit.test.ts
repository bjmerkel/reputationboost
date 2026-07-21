import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionType } from "@/audit/types";
import {
  buildBusinessArmStatsFromExperiments,
  selectActionWithBandit,
} from "./bandit";
import type { LeaderDeltaAction } from "./types";
import {
  AUTOPILOT_MODE_DESCRIPTIONS,
  modeCreatesExecutionTask,
  modeRunsNightlyProposals,
  modeShowsAutopilotUi,
  parseAutopilotMode,
} from "./modes";

function action(
  actionType: ExecutionType,
  planStepNumber: number,
  prior: number
): LeaderDeltaAction {
  return {
    actionType,
    planStepNumber,
    hypothesis: `Test ${actionType}`,
    marketPriorRankDelta: prior,
    confidence: "default",
    effort: 5,
  };
}

describe("autopilot modes", () => {
  it("parses known modes and defaults unknown values to manual", () => {
    assert.equal(parseAutopilotMode("auto"), "auto");
    assert.equal(parseAutopilotMode("bogus"), "manual");
  });

  it("describes nightly and task behavior per mode", () => {
    assert.equal(modeRunsNightlyProposals("suggest"), true);
    assert.equal(modeRunsNightlyProposals("manual"), false);
    assert.equal(modeCreatesExecutionTask("auto"), true);
    assert.equal(modeCreatesExecutionTask("suggest"), false);
    assert.equal(modeShowsAutopilotUi("off"), false);
    assert.ok(AUTOPILOT_MODE_DESCRIPTIONS.suggest.length > 10);
  });
});

describe("bandit selection", () => {
  it("respects manual action index override", () => {
    const actions = [
      action("review_request", 10, 4),
      action("gbp_photo", 6, 2),
    ];
    const selection = selectActionWithBandit({
      actions,
      marketKey: "plumber|TX|dallas",
      marketIndex: new Map(),
      mode: "manual",
      actionIndex: 1,
    });
    assert.equal(selection?.action.actionType, "gbp_photo");
    assert.equal(selection?.actionIndex, 1);
    assert.equal(selection?.explorationReason, "Manual arm override");
  });

  it("defaults to greedy ranking in manual mode", () => {
    const selection = selectActionWithBandit({
      actions: [
        action("review_request", 10, 4),
        action("gbp_photo", 6, 2),
      ],
      marketKey: "plumber|TX|dallas",
      marketIndex: new Map(),
      mode: "manual",
    });
    assert.equal(selection?.action.actionType, "review_request");
  });

  it("aggregates business arm stats from concluded experiments", () => {
    const stats = buildBusinessArmStatsFromExperiments([
      { actionType: "review_request", status: "won" },
      { actionType: "review_request", status: "lost" },
      { actionType: "gbp_photo", status: "inconclusive" },
    ]);
    assert.equal(stats.length, 2);
    const reviews = stats.find((row) => row.actionType === "review_request");
    assert.equal(reviews?.wins, 1);
    assert.equal(reviews?.losses, 1);
  });

  it("can explore a different arm in suggest mode after losses", () => {
    const actions = [
      action("review_request", 10, 4),
      action("gbp_photo", 6, 3),
    ];
    const selection = selectActionWithBandit({
      actions,
      marketKey: "plumber|TX|dallas",
      marketIndex: new Map(),
      mode: "suggest",
      businessStats: [
        {
          actionType: "review_request",
          wins: 0,
          losses: 4,
          inconclusive: 0,
        },
      ],
    });
    assert.ok(selection);
    assert.ok(selection.alternatives.length >= 2);
  });
});
