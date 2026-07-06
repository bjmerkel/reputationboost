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
  preflightDescriptionPublish,
  sanitizeGbpDescriptionForPublish,
  wasGbpDescriptionSimulated,
  GBP_DESCRIPTION_FIELD,
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

  it("strips phone numbers and keeps the sentence readable", () => {
    const result = sanitizeGbpDescriptionForPublish(
      "Car Spa Auto Electronics in Arlington, VA, specializes in top-quality car electronics services. " +
        "Call us at (703) 820-5400 to schedule your appointment today!"
    );
    assert.equal(result.removedPhoneNumbers, true);
    assert.doesNotMatch(result.text, /820|5400|\(\d{3}\)/);
    assert.match(result.text, /Call us to schedule your appointment today!/);
  });

  it("strips phone numbers in dashed, dotted, and international formats", () => {
    for (const phone of ["703-820-5400", "703.820.5400", "+1 703 820 5400", "+44 20 7946 0958"]) {
      const result = sanitizeGbpDescriptionForPublish(`Reach our team on ${phone} anytime.`);
      assert.equal(result.removedPhoneNumbers, true, `should strip "${phone}"`);
      assert.doesNotMatch(result.text, /\d{3}[\s.-]\d{4}|\d{4}\b.*\d{4}/);
    }
  });

  it("does not treat years or fractions as phone numbers", () => {
    const result = sanitizeGbpDescriptionForPublish(
      "Serving Arlington since 1998 with 24/7 emergency availability and 100% satisfaction focus."
    );
    assert.equal(result.removedPhoneNumbers, false);
    assert.match(result.text, /since 1998/);
    assert.match(result.text, /24\/7/);
  });

  it("notes phone removal in the sanitize summary", () => {
    const result = sanitizeGbpDescriptionForPublish("Call us at (703) 820-5400 today.");
    assert.match(
      buildDescriptionSanitizeNote(result) ?? "",
      /phone numbers were removed/i
    );
  });

  it("blocks publish when profile.description is processing on Google", () => {
    const preflight = preflightDescriptionPublish({
      pendingMask: GBP_DESCRIPTION_FIELD,
    });
    assert.equal(preflight.canPatch, false);
    assert.equal(preflight.isProcessing, true);
    assert.match(preflight.blockReason ?? "", /profile\.description/i);
  });

  it("blocks publish when profile.description has a Google conflict", () => {
    const preflight = preflightDescriptionPublish({
      diffMask: GBP_DESCRIPTION_FIELD,
    });
    assert.equal(preflight.canPatch, false);
    assert.equal(preflight.hasConflict, true);
    assert.match(preflight.blockReason ?? "", /Google Updates/i);
  });
});
