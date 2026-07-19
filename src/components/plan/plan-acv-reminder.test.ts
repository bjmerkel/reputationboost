import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PLAN_ACV_REMINDER_SNOOZE_MS,
  shouldShowPlanAcvReminder,
  snoozePlanAcvReminder,
} from "./plan-acv-reminder";

describe("shouldShowPlanAcvReminder", () => {
  it("returns false when ACV is already set", () => {
    assert.equal(
      shouldShowPlanAcvReminder({ businessId: "biz-1", avgCustomerValue: 350 }),
      false
    );
  });

  it("returns false when snoozed", () => {
    const businessId = `biz-snooze-${Date.now()}`;
    const now = Date.now();
    snoozePlanAcvReminder(businessId, PLAN_ACV_REMINDER_SNOOZE_MS, now);
    assert.equal(
      shouldShowPlanAcvReminder({ businessId, avgCustomerValue: null, now: now + 1000 }),
      false
    );
  });

  it("returns true when ACV is missing and not snoozed", () => {
    const businessId = `biz-open-${Date.now()}`;
    assert.equal(
      shouldShowPlanAcvReminder({ businessId, avgCustomerValue: null }),
      true
    );
  });
});
