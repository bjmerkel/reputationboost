import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "@/audit/types";
import {
  formatTargetCellAttributionLine,
  resolveTargetCellFromTask,
} from "./cell-attribution";
import { evaluateExperimentOutcome } from "./experiment-lifecycle";

describe("cell-attribution", () => {
  it("resolves target cell coordinates from execution task payload", () => {
    const task = {
      payload: {
        targetCell: { gridNorth: 0.5, gridEast: -0.3 },
      },
    } as ExecutionTask;
    assert.deepEqual(resolveTargetCellFromTask(task), {
      gridNorth: 0.5,
      gridEast: -0.3,
    });
  });

  it("formats target cell attribution line", () => {
    const line = formatTargetCellAttributionLine({
      gridNorth: 0.5,
      gridEast: -0.3,
      rankBefore: 11,
      rankAfter: 4,
    });
    assert.match(line, /0\.5 mi N/);
    assert.match(line, /#11/);
    assert.match(line, /#4/);
  });
});

describe("experiment outcome with cell ranks", () => {
  it("marks improved target cell as won", () => {
    const outcome = evaluateExperimentOutcome({ rankBefore: 9, rankAfter: 3 });
    assert.equal(outcome.status, "won");
    assert.equal(outcome.improved, true);
  });
});
