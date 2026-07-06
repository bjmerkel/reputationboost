import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatGbpApiError } from "./gbp-api-error";
import {
  buildDescriptionSanitizeNote,
  sanitizeGbpDescriptionForPublish,
} from "./gbp-description";

describe("gbp-api-error", () => {
  it("maps PROFILE_DESCRIPTION_CONTAINS_URL to a helpful message", () => {
    const message = formatGbpApiError({
      error: {
        message: "Request contains an invalid argument.",
        details: [{ errorCode: "PROFILE_DESCRIPTION_CONTAINS_URL" }],
      },
    });
    assert.match(message, /does not allow URLs/i);
  });

  it("maps STALE_DATA to conflict guidance", () => {
    const message = formatGbpApiError({
      error: {
        message: "Request contains an invalid argument.",
        details: [{ reason: "STALE_DATA" }],
      },
    });
    assert.match(message, /Google Updates/i);
  });

  it("includes forbidden words from metadata", () => {
    const message = formatGbpApiError({
      error: {
        message: "Request contains an invalid argument.",
        details: [
          {
            errorCode: "FORBIDDEN_WORDS",
            metadata: { forbidden_words: "near me" },
          },
        ],
      },
    });
    assert.match(message, /near me/);
  });

  it("falls back when Google only returns the generic invalid argument message", () => {
    const message = formatGbpApiError({
      error: { message: "Request contains an invalid argument." },
    });
    assert.match(message, /plain text only/i);
  });
});

describe("sanitizeGbpDescriptionForPublish", () => {
  it("removes URLs and normalizes whitespace", () => {
    const result = sanitizeGbpDescriptionForPublish(
      "Best car repair near me. Visit https://example.com today."
    );
    assert.equal(result.text, "Best car repair near me. Visit today.");
    assert.equal(result.removedUrls, true);
  });

  it("removes HTML tags", () => {
    const result = sanitizeGbpDescriptionForPublish(
      "Trusted <b>auto shop</b> serving Dallas."
    );
    assert.equal(result.text, "Trusted auto shop serving Dallas.");
    assert.equal(result.removedHtml, true);
  });

  it("simplifies excessive punctuation", () => {
    const result = sanitizeGbpDescriptionForPublish("Great service!!! Call today???");
    assert.equal(result.text, "Great service! Call today?");
    assert.equal(result.normalizedPunctuation, true);
  });

  it("flags promotional phrasing", () => {
    const result = sanitizeGbpDescriptionForPublish(
      "Cheapest car repair in town — everything 20% off this week."
    );
    assert.ok(result.contentPolicyWarnings.length > 0);
    assert.match(buildDescriptionSanitizeNote(result) ?? "", /may delay or reject/i);
  });

  it("builds a sanitize note when URLs are removed", () => {
    const result = sanitizeGbpDescriptionForPublish("Call us at www.example.com for service.");
    assert.match(buildDescriptionSanitizeNote(result) ?? "", /URLs were removed/i);
  });
});
