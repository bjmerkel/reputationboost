import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FullAuditPayload } from "@/audit/types";
import type { ReviewKeywordCampaign } from "@/lib/review-requests/campaign-storage";
import { getCampaignProgress, isCampaignTargetMet } from "./campaign-progress";

function auditFixture(): FullAuditPayload {
  return {
    reviews: {
      reviews: [
        {
          text: "Great after school program",
          publishedAt: "2026-07-01T00:00:00.000Z",
        },
        {
          text: "Love the tutoring here",
          publishedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    },
  } as FullAuditPayload;
}

function campaignFixture(overrides: Partial<ReviewKeywordCampaign> = {}): ReviewKeywordCampaign {
  return {
    id: "camp-1",
    business_id: "biz-1",
    user_id: "user-1",
    keyword: "after school programs las vegas",
    started_at: "2026-07-01T00:00:00.000Z",
    baseline_mention_count: 0,
    target_reviews: 2,
    attributed_reviews: 0,
    status: "active",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getCampaignProgress", () => {
  it("tracks mentions since campaign start", () => {
    const progress = getCampaignProgress(auditFixture(), campaignFixture());
    assert.equal(progress.newMentionsSinceStart, 1);
    assert.equal(progress.reviewsRemaining, 1);
    assert.equal(progress.isComplete, false);
  });

  it("marks campaign complete when target is met via mentions", () => {
    const progress = getCampaignProgress(
      auditFixture(),
      campaignFixture({ target_reviews: 1 })
    );
    assert.equal(progress.isComplete, true);
    assert.ok(isCampaignTargetMet(auditFixture(), campaignFixture({ target_reviews: 1 })));
  });

  it("marks campaign complete when attributed reviews reach target", () => {
    const campaign = campaignFixture({ target_reviews: 3, attributed_reviews: 3 });
    const progress = getCampaignProgress(auditFixture(), campaign);
    assert.equal(progress.isComplete, true);
  });
});
