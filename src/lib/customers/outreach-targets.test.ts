import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customerHasEmail,
  customerHasSms,
  getOutreachTargets,
} from "@/lib/customers/outreach-targets";

describe("getOutreachTargets", () => {
  it("sends both channels in auto mode when customer has both contacts", () => {
    assert.deepEqual(
      getOutreachTargets("auto", {
        phone: "2145550100",
        email: "jane@example.com",
      }),
      { email: true, sms: true }
    );
  });

  it("sends only email in auto mode when phone is missing", () => {
    assert.deepEqual(
      getOutreachTargets("auto", {
        phone: null,
        email: "jane@example.com",
      }),
      { email: true, sms: false }
    );
  });

  it("sends only sms in auto mode when email is missing", () => {
    assert.deepEqual(
      getOutreachTargets("auto", {
        phone: "2145550100",
        email: null,
      }),
      { email: false, sms: true }
    );
  });

  it("limits email channel to email only", () => {
    assert.deepEqual(
      getOutreachTargets("email", {
        phone: "2145550100",
        email: "jane@example.com",
      }),
      { email: true, sms: false }
    );
  });

  it("limits sms channel to sms only", () => {
    assert.deepEqual(
      getOutreachTargets("sms", {
        phone: "2145550100",
        email: "jane@example.com",
      }),
      { email: false, sms: true }
    );
  });
});

describe("customer contact helpers", () => {
  it("detects valid email and phone", () => {
    assert.equal(customerHasEmail({ email: "jane@example.com" }), true);
    assert.equal(customerHasSms({ phone: "2145550100" }), true);
    assert.equal(customerHasEmail({ email: "not-an-email" }), false);
    assert.equal(customerHasSms({ phone: "abc" }), false);
  });
});
