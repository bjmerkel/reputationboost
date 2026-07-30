import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProfileGuideReadiness,
  isProfileGuideReviewReady,
  planReviewRequestsHref,
  profileGuideEditorHref,
} from "./readiness";
import type { ProfileGuideWithLinks } from "./types";

function guideFixture(overrides: Partial<ProfileGuideWithLinks["guide"]> = {}): ProfileGuideWithLinks {
  return {
    guide: {
      id: "g1",
      business_id: "b1",
      user_id: "u1",
      slug: "test-biz",
      display_name: "Test Biz",
      published: false,
      published_at: null,
      primary_color: "#1a73e8",
      background_color: "#f8f9fa",
      button_style: "rounded",
      font_preset: "professional",
      logo_url: null,
      background_image_url: null,
      tagline: null,
      text_message: null,
      gbp_synced_at: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      ...overrides,
    },
    links: [
      {
        id: "l1",
        guide_id: "g1",
        link_type: "review",
        label: "Leave a review",
        url: "https://example.com/review",
        sort_order: 0,
        enabled: true,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ],
  };
}

describe("buildProfileGuideReadiness", () => {
  it("returns empty readiness when guide is missing", () => {
    const readiness = buildProfileGuideReadiness({ guide: null });
    assert.equal(readiness.exists, false);
    assert.equal(readiness.published, false);
    assert.equal(readiness.reviewLinkEnabled, false);
  });

  it("detects published guide with review link", () => {
    const readiness = buildProfileGuideReadiness({
      guide: guideFixture({ published: true }),
      views30d: 12,
      attributedReviews30d: 2,
    });

    assert.equal(readiness.exists, true);
    assert.equal(readiness.published, true);
    assert.equal(readiness.reviewLinkEnabled, true);
    assert.equal(readiness.views30d, 12);
    assert.equal(readiness.attributedReviews30d, 2);
    assert.equal(isProfileGuideReviewReady(readiness), true);
  });
});

describe("profileGuideEditorHref", () => {
  it("builds plan deep link with publish focus", () => {
    assert.equal(
      profileGuideEditorHref("biz-1", { from: "plan", focus: "publish" }),
      "/platform/customers?businessId=biz-1&tab=profile-guide&from=plan&focus=publish"
    );
  });
});

describe("planReviewRequestsHref", () => {
  it("builds audit plan deep link to review requests step", () => {
    assert.equal(
      planReviewRequestsHref("biz-1"),
      "/platform/audit?businessId=biz-1&view=strategy&focusStep=10"
    );
  });
});
