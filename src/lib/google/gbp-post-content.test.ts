import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyGooglePost } from "./gbp-apply";
import {
  buildPostSanitizeNote,
  detectPostOfferLanguage,
  sanitizeGbpPostSummary,
} from "./gbp-post-content";

describe("sanitizeGbpPostSummary", () => {
  it("strips phone numbers from post text and keeps the CTA readable", () => {
    const result = sanitizeGbpPostSummary(
      "Looking for car audio installation in Arlington? Call us at (703) 820-5400 today!"
    );
    assert.equal(result.removedPhoneNumbers, true);
    assert.doesNotMatch(result.text, /820|5400/);
    assert.match(result.text, /Call us today!/);
  });

  it("strips URLs from post text", () => {
    const result = sanitizeGbpPostSummary(
      "Book your spring tune-up at https://example.com/book or visit www.example.com now."
    );
    assert.equal(result.removedUrls, true);
    assert.doesNotMatch(result.text, /https?:|www\./);
  });

  it("preserves line breaks and emoji", () => {
    const result = sanitizeGbpPostSummary("🏠 New service alert!\n\nNow offering CarPlay installs.");
    assert.match(result.text, /🏠 New service alert!\n\nNow offering CarPlay installs\./);
  });

  it("flags deal and promotion language for hotel/offer policy", () => {
    const warnings = detectPostOfferLanguage(
      "Limited time offer: 20% off weekend stays — use promo code SPRING."
    );
    assert.ok(warnings.length >= 2);
  });

  it("builds a note explaining removals and offer-language risk", () => {
    const result = sanitizeGbpPostSummary(
      "Special offer! Call 703-820-5400 or visit https://example.com to save 10% off."
    );
    const note = buildPostSanitizeNote(result) ?? "";
    assert.match(note, /phone numbers were removed/i);
    assert.match(note, /URLs were removed/i);
    assert.match(note, /hotel and lodging/i);
  });

  it("returns no note for clean post text", () => {
    const result = sanitizeGbpPostSummary("Now offering CarPlay installs in Arlington. Tap Call to book.");
    assert.equal(buildPostSanitizeNote(result), null);
  });
});

describe("applyGooglePost", () => {
  it("publishes the sanitized summary with a Call CTA button", async () => {
    const originalFetch = globalThis.fetch;
    let sentBody: { summary?: string; callToAction?: { actionType?: string } } = {};
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({ name: "accounts/a1/locations/1/localPosts/p1", summary: sentBody.summary }),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const result = await applyGooglePost(
        {
          businessId: "b1",
          accountId: "a1",
          locationId: "1",
          accessToken: "fake-token",
          refreshToken: "refresh",
          expiresAt: new Date().toISOString(),
        },
        "Best car electronics in Arlington. Call us at (703) 820-5400 or visit https://example.com!"
      );

      assert.equal(result.success, true);
      assert.doesNotMatch(sentBody.summary ?? "", /820|5400|https?:/);
      assert.equal(sentBody.callToAction?.actionType, "CALL");
      assert.match(result.message, /phone numbers were removed/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
