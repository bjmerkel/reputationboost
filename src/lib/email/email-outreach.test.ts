import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReviewEmailContent, previewReviewEmailContent } from "@/lib/email/template";
import { buildUnsubscribeToken, parseUnsubscribeToken } from "@/lib/email/unsubscribe";
import { normalizeEmail } from "@/lib/email/resend";
import { googleWriteReviewUrl } from "@/lib/sms/review-link";

describe("normalizeEmail", () => {
  it("normalizes valid emails", () => {
    assert.equal(normalizeEmail(" Jane@Example.COM "), "jane@example.com");
  });

  it("rejects invalid emails", () => {
    assert.equal(normalizeEmail("not-an-email"), null);
  });
});

describe("buildReviewEmailContent", () => {
  it("personalizes subject and body with review CTA", () => {
    const content = buildReviewEmailContent({
      subjectTemplate: "How was [BUSINESS]?",
      bodyTemplate:
        "Hi [FIRST_NAME], thanks for choosing [BUSINESS] for [SERVICE]. Please review us: [REVIEW_LINK]",
      customer: { first_name: "Jane", last_name: "Doe", service_notes: "AC repair" },
      businessName: "Cool Air",
      reviewUrl: googleWriteReviewUrl("ChIJtest"),
      unsubscribeUrl: "https://example.com/unsubscribe",
    });

    assert.match(content.subject, /Cool Air/);
    assert.match(content.bodyText, /Jane/);
    assert.match(content.bodyText, /AC repair/);
    assert.match(content.bodyHtml, /Leave a Google review/);
    assert.match(content.bodyHtml, /unsubscribe/i);
  });
});

describe("previewReviewEmailContent", () => {
  it("uses sample customer when none provided", () => {
    const content = previewReviewEmailContent({
      subjectTemplate: "Thanks from [BUSINESS]",
      bodyTemplate: "Hi [FIRST_NAME], please review us: [REVIEW_LINK]",
      businessName: "Cool Air",
      reviewUrl: googleWriteReviewUrl("ChIJtest"),
    });

    assert.match(content.bodyText, /Alex|Customer/);
  });
});

describe("unsubscribe tokens", () => {
  it("round-trips customer and business ids", () => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    const token = buildUnsubscribeToken("customer-1", "business-1");
    const parsed = parseUnsubscribeToken(token);
    assert.deepEqual(parsed, {
      customerId: "customer-1",
      businessId: "business-1",
    });
  });

  it("rejects tampered tokens", () => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret";
    const token = buildUnsubscribeToken("customer-1", "business-1");
    assert.equal(parseUnsubscribeToken(`${token}x`), null);
  });
});
