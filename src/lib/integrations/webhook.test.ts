import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTriggerEvent,
  normalizeWebhookPayload,
} from "@/lib/integrations/normalize-webhook-payload";
import { extractWebhookToken } from "@/lib/integrations/webhook-token";

describe("normalizeWebhookPayload", () => {
  it("normalizes common CRM field names", () => {
    const payload = normalizeWebhookPayload({
      event_type: "job.completed",
      phone_number: "214-555-0100",
      first_name: "Jane",
      last_name: "Doe",
      job_title: "AC repair",
      job_id: "job-1",
      source: "jobber",
      send_review_request: true,
    });

    assert.equal(payload.event, "job.completed");
    assert.equal(payload.phone, "214-555-0100");
    assert.equal(payload.service, "AC repair");
    assert.equal(payload.externalId, "job-1");
    assert.equal(payload.sendReviewRequest, true);
  });

  it("requires event and phone", () => {
    assert.throws(() => normalizeWebhookPayload({ phone: "2145550100" }), /event/);
    assert.throws(() => normalizeWebhookPayload({ event: "job.completed" }), /phone/);
  });
});

describe("isTriggerEvent", () => {
  it("matches configured trigger events case-insensitively", () => {
    assert.equal(isTriggerEvent("Job.Completed", ["job.completed"]), true);
    assert.equal(isTriggerEvent("estimate.sent", ["job.completed"]), false);
  });
});

describe("extractWebhookToken", () => {
  it("reads token from query string", () => {
    const request = new Request("https://example.com/api/integrations/webhook?token=wb_test");
    assert.equal(extractWebhookToken(request), "wb_test");
  });

  it("reads token from authorization header", () => {
    const request = new Request("https://example.com/api/integrations/webhook", {
      headers: { Authorization: "Bearer wb_test" },
    });
    assert.equal(extractWebhookToken(request), "wb_test");
  });
});
