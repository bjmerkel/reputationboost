import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEPRECATED_NOTIFICATION_TYPES,
  RECOMMENDED_NOTIFICATION_TYPES,
  notificationTypeLabel,
} from "./gbp-notifications";
import {
  analyzeGbpNotificationCoverage,
  formatEnabledNotificationSummary,
} from "./gbp-notifications-coverage";

describe("analyzeGbpNotificationCoverage", () => {
  it("marks unconfigured accounts with zero coverage", () => {
    const coverage = analyzeGbpNotificationCoverage(null);
    assert.equal(coverage.configured, false);
    assert.equal(coverage.coverageScore, 0);
    assert.equal(coverage.enabledTypes.length, 0);
    assert.equal(coverage.missingRecommendedTypes.length, RECOMMENDED_NOTIFICATION_TYPES.length);
  });

  it("scores partial and full recommended subscriptions", () => {
    const partial = analyzeGbpNotificationCoverage({
      name: "accounts/123/notificationSetting",
      pubsubTopic: "projects/demo/topics/gbp",
      notificationTypes: ["NEW_REVIEW", "GOOGLE_UPDATE"],
    });
    assert.equal(partial.configured, true);
    assert.equal(partial.hasReviewAlerts, true);
    assert.equal(partial.hasGoogleUpdateAlerts, true);
    assert.equal(partial.hasCustomerMediaAlerts, false);
    assert.ok(partial.coverageScore > 0 && partial.coverageScore < 100);

    const full = analyzeGbpNotificationCoverage({
      name: "accounts/123/notificationSetting",
      pubsubTopic: "projects/demo/topics/gbp",
      notificationTypes: [...RECOMMENDED_NOTIFICATION_TYPES],
    });
    assert.equal(full.coverageScore, 100);
    assert.equal(full.missingRecommendedTypes.length, 0);
  });

  it("flags deprecated notification types", () => {
    const coverage = analyzeGbpNotificationCoverage({
      name: "accounts/123/notificationSetting",
      pubsubTopic: "projects/demo/topics/gbp",
      notificationTypes: ["NEW_REVIEW", "NEW_QUESTION"],
    });
    assert.ok(coverage.deprecatedTypesEnabled.includes("NEW_QUESTION"));
    assert.ok(DEPRECATED_NOTIFICATION_TYPES.has("NEW_QUESTION"));
  });
});

describe("formatEnabledNotificationSummary", () => {
  it("summarizes enabled notification labels", () => {
    const summary = formatEnabledNotificationSummary(["NEW_REVIEW", "GOOGLE_UPDATE"]);
    assert.match(summary, /New reviews/);
    assert.match(summary, /Google suggested edits/);
  });
});
