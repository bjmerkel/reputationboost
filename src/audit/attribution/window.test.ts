import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENGAGEMENT_ATTRIBUTION_WINDOW_DAYS,
  RANK_ATTRIBUTION_WINDOW_DAYS,
  resolveAttributionWindowDays,
} from "./window";

describe("resolveAttributionWindowDays", () => {
  it("uses 14 days for rank-affecting GBP field tasks", () => {
    assert.equal(resolveAttributionWindowDays("gbp_description"), RANK_ATTRIBUTION_WINDOW_DAYS);
    assert.equal(resolveAttributionWindowDays("gbp_services"), RANK_ATTRIBUTION_WINDOW_DAYS);
  });

  it("uses 7 days for engagement-only tasks", () => {
    assert.equal(resolveAttributionWindowDays("review_response"), ENGAGEMENT_ATTRIBUTION_WINDOW_DAYS);
    assert.equal(resolveAttributionWindowDays("google_post"), ENGAGEMENT_ATTRIBUTION_WINDOW_DAYS);
    assert.equal(resolveAttributionWindowDays("review_request"), ENGAGEMENT_ATTRIBUTION_WINDOW_DAYS);
  });
});
