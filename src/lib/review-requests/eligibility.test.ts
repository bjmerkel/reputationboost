import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CustomerRecord } from "@/lib/customers/types";
import {
  auditHasReviewGap,
  evaluateReviewRequestEligibility,
  REVIEW_REQUEST_COOLDOWN_DAYS,
} from "@/lib/review-requests/eligibility";

function customer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: "c1",
    business_id: "b1",
    user_id: "u1",
    first_name: "Jane",
    last_name: "Doe",
    phone: "+12145550100",
    email: null,
    service_notes: null,
    last_service_date: null,
    source: "webhook",
    opted_out: false,
    review_requested_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("evaluateReviewRequestEligibility", () => {
  it("allows manual sends when customer is otherwise eligible", () => {
    const result = evaluateReviewRequestEligibility({
      customer: customer(),
      manualSend: true,
      auditHasReviewGap: false,
    });
    assert.equal(result.eligible, true);
  });

  it("blocks auto-send when audit has no review gap", () => {
    const result = evaluateReviewRequestEligibility({
      customer: customer(),
      autoSend: true,
      eventType: "job.completed",
      triggerEvents: ["job.completed"],
      auditHasReviewGap: false,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "no_review_gap");
  });

  it("allows explicit webhook send even without review gap", () => {
    const result = evaluateReviewRequestEligibility({
      customer: customer(),
      explicitSend: true,
      auditHasReviewGap: false,
    });
    assert.equal(result.eligible, true);
  });

  it("enforces cooldown after recent review request", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - (REVIEW_REQUEST_COOLDOWN_DAYS - 1));

    const result = evaluateReviewRequestEligibility({
      customer: customer({ review_requested_at: recent.toISOString() }),
      manualSend: true,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "cooldown_active");
  });

  it("blocks estimate events", () => {
    const result = evaluateReviewRequestEligibility({
      customer: customer(),
      manualSend: true,
      eventType: "estimate.sent",
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reason, "blocked_event_type");
  });
});

describe("auditHasReviewGap", () => {
  it("detects review-gap flags in audit", () => {
    assert.equal(
      auditHasReviewGap({
        strategy: {
          gaps: [{ id: "review-gap-plumber", title: "", description: "", priority: "high", category: "reviews", impact: 1, effort: 1, impactScore: 1 }],
        },
      } as never),
      true
    );
  });
});
