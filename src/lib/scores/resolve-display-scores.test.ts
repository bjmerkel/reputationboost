import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveDisplayScores } from "./resolve-display-scores";
import type { FullAuditPayload } from "@/audit/types";

function auditWithScores(overall: number, driverScore: number, outcomeIndex: number) {
  return {
    strategy: {
      scores: {
        overall,
        grade: "at_risk" as const,
        driverScore,
        outcomeIndex,
        visibility: 70,
        conversion: driverScore,
        revenueCapture: 80,
        insight: { weakestComponent: "driver" as const, topOpportunityKeyword: null, nextAction: null },
      },
    },
  } as FullAuditPayload;
}

describe("resolveDisplayScores", () => {
  it("blends driver and outcome into a consistent headline score", () => {
    const resolved = resolveDisplayScores(auditWithScores(65, 62, 73));
    assert.equal(resolved?.overall, 65);
    assert.equal(resolved?.scores.driverScore, 62);
    assert.equal(resolved?.scores.outcomeIndex, 73);
  });

  it("ignores stale nightly overall when sub-scores disagree", () => {
    const resolved = resolveDisplayScores(auditWithScores(65, 62, 73), {
      overall: 77,
      driverScore: 62,
      outcomeIndex: 73,
      date: "2026-07-29",
    });
    assert.equal(resolved?.overall, 65);
    assert.equal(resolved?.nightlyOverall, 77);
  });

  it("uses nightly driver/outcome when provided", () => {
    const resolved = resolveDisplayScores(auditWithScores(65, 62, 73), {
      overall: 80,
      driverScore: 79,
      outcomeIndex: 73,
      date: "2026-07-29",
    });
    assert.equal(resolved?.overall, 77);
    assert.equal(resolved?.scores.driverScore, 79);
    assert.equal(resolved?.nightlyOverall, 80);
  });
});
