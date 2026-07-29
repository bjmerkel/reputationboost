import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDeliverWebhookOutreach,
  resolveWebhookOutreachChannel,
} from "@/lib/integrations/webhook-outreach";

describe("resolveWebhookOutreachChannel", () => {
  it("uses auto when both email and phone are present", () => {
    assert.equal(
      resolveWebhookOutreachChannel("auto", {
        phone: "2145550100",
        email: "jane@example.com",
      }),
      "auto"
    );
  });

  it("falls back to sms in auto mode without email", () => {
    assert.equal(
      resolveWebhookOutreachChannel("auto", {
        phone: "2145550100",
        email: null,
      }),
      "sms"
    );
  });

  it("honors explicit email channel", () => {
    assert.equal(
      resolveWebhookOutreachChannel("email", {
        phone: "2145550100",
        email: "jane@example.com",
      }),
      "email"
    );
  });
});

describe("canDeliverWebhookOutreach", () => {
  it("requires email for email-only mode", () => {
    assert.equal(
      canDeliverWebhookOutreach("email", {
        phone: "2145550100",
        email: null,
      }),
      false
    );
    assert.equal(
      canDeliverWebhookOutreach("email", {
        phone: "2145550100",
        email: "jane@example.com",
      }),
      true
    );
  });
});
