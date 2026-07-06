import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDescriptionApplyMessage,
  buildDescriptionSanitizeNote,
  descriptionsMatch,
  GBP_DESCRIPTION_MAX_LENGTH,
  isGbpDescriptionLiveSync,
  needsGbpDescriptionRepublish,
  normalizeGbpDescription,
  sanitizeGbpDescriptionForPublish,
  wasGbpDescriptionSimulated,
} from "./gbp-description";

describe("gbp-description", () => {
  it("normalizes whitespace for comparison", () => {
    assert.equal(
      normalizeGbpDescription("  car   repair\nnear me  "),
      "car repair near me"
    );
  });

  it("matches descriptions with equivalent whitespace", () => {
    assert.equal(
      descriptionsMatch("car repair near me", "car  repair\nnear me"),
      true
    );
  });

  it("matches when Google truncates to the 750 character cap", () => {
    const long = "a".repeat(GBP_DESCRIPTION_MAX_LENGTH + 40);
    const truncated = "a".repeat(GBP_DESCRIPTION_MAX_LENGTH);
    assert.equal(descriptionsMatch(long, truncated), true);
  });

  it("detects simulated execution results", () => {
    assert.equal(wasGbpDescriptionSimulated("Updated GBP business description."), true);
    assert.equal(
      wasGbpDescriptionSimulated("Description verified on Google Business Profile."),
      false
    );
  });

  it("detects live sync results", () => {
    assert.equal(
      isGbpDescriptionLiveSync("Description verified on Google Business Profile."),
      true
    );
    assert.equal(isGbpDescriptionLiveSync("Updated GBP business description."), false);
  });

  it("flags completed tasks that still need republish", () => {
    assert.equal(
      needsGbpDescriptionRepublish({
        type: "gbp_description",
        status: "completed",
        result: "Updated GBP business description.",
      }),
      true
    );
    assert.equal(
      needsGbpDescriptionRepublish({
        type: "gbp_description",
        status: "completed",
        result: "Description verified on Google Business Profile.",
      }),
      false
    );
    assert.equal(
      needsGbpDescriptionRepublish({
        type: "gbp_description",
        status: "failed",
        result: "Google accepted the update but the description is not showing on your profile yet.",
      }),
      true
    );
  });

  it("builds pending-edits failure message", () => {
    const outcome = buildDescriptionApplyMessage(
      { verified: false, hasPendingEdits: true, liveDescription: "old text" },
      500
    );
    assert.equal(outcome.success, false);
    assert.match(outcome.message, /pending edits/i);
  });

  it("builds verified success message", () => {
    const outcome = buildDescriptionApplyMessage(
      { verified: true, hasPendingEdits: false, liveDescription: "car repair near me" },
      20
    );
    assert.equal(outcome.success, true);
    assert.match(outcome.message, /verified on Google Business Profile/i);
  });

  it("builds processing success message", () => {
    const outcome = buildDescriptionApplyMessage(
      {
        verified: false,
        hasPendingEdits: false,
        liveDescription: "old",
        isProcessing: true,
      },
      500
    );
    assert.equal(outcome.success, true);
    assert.match(outcome.message, /processing|reviewing/i);
  });

  it("builds diff conflict failure message", () => {
    const outcome = buildDescriptionApplyMessage(
      {
        verified: false,
        hasPendingEdits: false,
        liveDescription: "google version",
        hasDiff: true,
      },
      500
    );
    assert.equal(outcome.success, false);
    assert.match(outcome.message, /different description/i);
  });

  it("strips URLs before publish", () => {
    const result = sanitizeGbpDescriptionForPublish(
      "Trusted auto shop. Book at https://shop.example/repairs now."
    );
    assert.equal(result.removedUrls, true);
    assert.doesNotMatch(result.text, /https?:\/\//);
  });

  it("strips HTML before publish", () => {
    const result = sanitizeGbpDescriptionForPublish(
      "<p>Family-owned <strong>auto repair</strong> shop.</p>"
    );
    assert.equal(result.removedHtml, true);
    assert.doesNotMatch(result.text, /</);
  });
});
