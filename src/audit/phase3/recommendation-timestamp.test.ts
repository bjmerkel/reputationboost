import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRecommendationTimestamp } from "./recommendation-timestamp";

describe("resolveRecommendationTimestamp", () => {
  it("uses the newest open task createdAt", () => {
    const iso = resolveRecommendationTimestamp({
      tasks: [
        {
          status: "pending_approval",
          createdAt: "2026-07-08T12:00:00.000Z",
        },
        {
          status: "pending_approval",
          createdAt: "2026-07-10T15:30:00.000Z",
        },
        {
          status: "completed",
          createdAt: "2026-07-11T01:00:00.000Z",
        },
      ],
      planReconciledAt: "2026-07-01T00:00:00.000Z",
    });

    assert.equal(iso, "2026-07-10T15:30:00.000Z");
  });

  it("prefers a draft refresh timestamp when newer", () => {
    const iso = resolveRecommendationTimestamp({
      tasks: [
        {
          status: "pending_approval",
          createdAt: "2026-07-08T12:00:00.000Z",
          payload: { descriptionDraftRefreshedAt: "2026-07-10T18:00:00.000Z" },
        },
      ],
    });

    assert.equal(iso, "2026-07-10T18:00:00.000Z");
  });

  it("uses recommendedAt stamps from profile/plan refresh", () => {
    const iso = resolveRecommendationTimestamp({
      tasks: [
        {
          status: "pending_approval",
          createdAt: "2026-07-11T02:01:00.000Z",
          payload: { recommendedAt: "2026-07-15T13:00:00.000Z" },
        },
      ],
      planReconciledAt: "2026-07-15T13:00:00.000Z",
    });

    assert.equal(iso, "2026-07-15T13:00:00.000Z");
  });

  it("falls back to plan reconcile time when no open tasks", () => {
    const iso = resolveRecommendationTimestamp({
      tasks: [{ status: "completed", createdAt: "2026-07-08T12:00:00.000Z" }],
      planReconciledAt: "2026-07-09T09:00:00.000Z",
      strategyGeneratedAt: "2026-07-01T00:00:00.000Z",
    });

    assert.equal(iso, "2026-07-09T09:00:00.000Z");
  });
});
