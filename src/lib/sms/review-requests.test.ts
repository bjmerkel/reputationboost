import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCustomerCsv, parseCustomerJson } from "@/lib/customers/parse-import";
import { normalizePhoneE164 } from "@/lib/sms/phone";
import { personalizeReviewRequestSms, ensureBusinessInTemplate, previewReviewRequestSms } from "@/lib/sms/personalize";
import {
  googleReviewUrlForBusiness,
  googleWriteReviewUrl,
  substituteReviewLink,
} from "@/lib/sms/review-link";

describe("normalizePhoneE164", () => {
  it("normalizes US 10-digit numbers", () => {
    assert.equal(normalizePhoneE164("(214) 555-0100"), "+12145550100");
  });

  it("rejects too-short numbers", () => {
    assert.equal(normalizePhoneE164("555"), null);
  });
});

describe("googleReviewUrlForBusiness", () => {
  it("prefers place ID write-review URL", () => {
    assert.equal(
      googleReviewUrlForBusiness({ placeId: "ChIJabc123" }),
      "https://search.google.com/local/writereview?placeid=ChIJabc123"
    );
  });

  it("falls back to maps URL", () => {
    const url = googleReviewUrlForBusiness({
      name: "Test Plumbing",
      address: "123 Main St, Dallas, TX",
    });
    assert.ok(url?.includes("google.com/maps"));
  });
});

describe("substituteReviewLink", () => {
  it("replaces placeholders", () => {
    const result = substituteReviewLink(
      "Hi [FIRST_NAME]! Review us: [REVIEW_LINK]",
      "https://example.com/review",
      { FIRST_NAME: "Sam" }
    );
    assert.equal(result, "Hi Sam! Review us: https://example.com/review");
  });
});

describe("personalizeReviewRequestSms", () => {
  it("personalizes customer fields", () => {
    const message = personalizeReviewRequestSms({
      template: "Hi [FIRST_NAME]! Thanks for choosing [BUSINESS] for [SERVICE]. [REVIEW_LINK]",
      customer: { first_name: "Jane", last_name: "Doe", service_notes: "AC repair" },
      businessName: "Cool Air",
      reviewUrl: googleWriteReviewUrl("ChIJtest"),
    });
    assert.match(message, /Hi Jane!/);
    assert.match(message, /Cool Air/);
    assert.match(message, /AC repair/);
    assert.match(message, /writereview/);
  });

  it("injects business name when template omits it", () => {
    const template =
      "Hi [FIRST_NAME], it was a pleasure having your child in our [SERVICE]! We strive for quality and communication, and your feedback means a lot. If you could take a moment to leave us a quick Google review, it would really help us out. Thank you! [REVIEW_LINK]";
    const message = personalizeReviewRequestSms({
      template,
      customer: { first_name: "Sam", last_name: "Lee", service_notes: "after school program" },
      businessName: "Northshore Learning Center",
      reviewUrl: googleWriteReviewUrl("ChIJtest"),
    });
    assert.match(message, /Northshore Learning Center/);
    assert.match(message, /Hi Sam/);
    assert.match(message, /after school program/);
  });
});

describe("ensureBusinessInTemplate", () => {
  it("leaves templates that already include [BUSINESS]", () => {
    const template = "Hi [FIRST_NAME], thanks for visiting [BUSINESS]! [REVIEW_LINK]";
    assert.equal(ensureBusinessInTemplate(template, "Acme Co"), template);
  });

  it("injects [BUSINESS] after the greeting when missing", () => {
    const result = ensureBusinessInTemplate(
      "Hi [FIRST_NAME], it was a pleasure having your child in our [SERVICE]! [REVIEW_LINK]",
      "Northshore Learning Center"
    );
    assert.match(result, /thank you for choosing \[BUSINESS\]/i);
  });
});

describe("previewReviewRequestSms", () => {
  it("substitutes business name even without a sample customer", () => {
    const preview = previewReviewRequestSms({
      template:
        "Hi [FIRST_NAME], it was a pleasure having your child in our [SERVICE]! [REVIEW_LINK]",
      businessName: "Northshore Learning Center",
      reviewUrl: "https://example.com/review",
      serviceFallback: "after school programs",
    });
    assert.match(preview, /Northshore Learning Center/);
    assert.match(preview, /after school programs/);
    assert.doesNotMatch(preview, /\[BUSINESS\]/);
  });
});

describe("parseCustomerCsv", () => {
  it("parses standard CSV headers", () => {
    const csv = `first_name,last_name,phone,service
Jane,Doe,214-555-0100,water heater
John,Smith,(972) 555-0199,drain cleaning`;

    const { rows, errors } = parseCustomerCsv(csv);
    assert.equal(errors.length, 0);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].firstName, "Jane");
    assert.equal(rows[0].phone, "214-555-0100");
    assert.equal(rows[0].serviceNotes, "water heater");
  });

  it("requires phone column", () => {
    const { errors } = parseCustomerCsv("name,email\nJane,jane@example.com");
    assert.ok(errors.some((e) => e.includes("phone")));
  });
});

describe("parseCustomerJson", () => {
  it("parses JSON array", () => {
    const { rows } = parseCustomerJson([
      { firstName: "Alex", phone: "2145550100", serviceNotes: "install" },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].firstName, "Alex");
  });
});
