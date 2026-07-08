import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTRIBUTION_WINDOW_DAYS,
  namesMatchForAttribution,
  normalizePersonName,
  parseReviewIdFromReviewName,
  pickAttributionCandidate,
} from "@/lib/review-requests/attribution";

describe("ATTRIBUTION_WINDOW_DAYS", () => {
  it("uses a 14-day outreach attribution window", () => {
    assert.equal(ATTRIBUTION_WINDOW_DAYS, 14);
  });
});

describe("parseReviewIdFromReviewName", () => {
  it("extracts review id from GBP review resource name", () => {
    assert.equal(
      parseReviewIdFromReviewName("accounts/1/locations/2/reviews/abc123"),
      "abc123"
    );
  });

  it("returns null for empty values", () => {
    assert.equal(parseReviewIdFromReviewName(""), null);
  });
});

describe("namesMatchForAttribution", () => {
  it("matches full reviewer and customer names", () => {
    assert.equal(namesMatchForAttribution("Jane Doe", "Jane", "Doe"), true);
  });

  it("matches when reviewer includes first and last name", () => {
    assert.equal(namesMatchForAttribution("Jane M. Doe", "Jane", "Doe"), true);
  });

  it("rejects anonymous reviewers", () => {
    assert.equal(namesMatchForAttribution("A Google User", "Jane", "Doe"), false);
  });

  it("rejects unrelated names", () => {
    assert.equal(namesMatchForAttribution("John Smith", "Jane", "Doe"), false);
  });
});

describe("normalizePersonName", () => {
  it("strips punctuation and lowercases", () => {
    assert.equal(normalizePersonName("Jane M. Doe"), "jane m doe");
  });
});

interface SentSmsCandidate {
  id: string;
  customer_id: string | null;
  sent_at: string;
  focus_keyword?: string | null;
  customers?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

describe("pickAttributionCandidate", () => {
  const messages: SentSmsCandidate[] = [
    {
      id: "sms-1",
      customer_id: "c1",
      sent_at: "2026-07-05T12:00:00.000Z",
      focus_keyword: "after school programs las vegas",
      customers: { first_name: "Jane", last_name: "Doe" },
    },
    {
      id: "sms-2",
      customer_id: "c2",
      sent_at: "2026-07-04T12:00:00.000Z",
      focus_keyword: "tutoring las vegas",
      customers: { first_name: "John", last_name: "Smith" },
    },
  ];

  it("prefers a name match over the most recent SMS", () => {
    const picked = pickAttributionCandidate(messages, new Set(), "John Smith");
    assert.equal(picked?.candidate.id, "sms-2");
    assert.equal(picked?.method, "name_match");
  });

  it("falls back to the most recent unattributed SMS", () => {
    const picked = pickAttributionCandidate(messages, new Set(), "Anonymous");
    assert.equal(picked?.candidate.id, "sms-1");
    assert.equal(picked?.method, "time_window");
  });

  it("prefers keyword match in review text when available", () => {
    const picked = pickAttributionCandidate(
      messages,
      new Set(),
      "Anonymous",
      "Our kids love the after school program here"
    );
    assert.equal(picked?.candidate.id, "sms-1");
    assert.equal(picked?.method, "keyword_match");
  });

  it("skips already attributed SMS rows", () => {
    const picked = pickAttributionCandidate(messages, new Set(["sms-1"]), "Jane Doe");
    assert.equal(picked?.candidate.id, "sms-2");
  });
});
