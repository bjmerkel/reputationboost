import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MANUAL_PLAN_SYNC_COOLDOWN_MS,
  shouldAutoLiveSyncManualPlan,
} from "./plan-manual-sync";

describe("shouldAutoLiveSyncManualPlan", () => {
  it("skips when GBP is disconnected or there are no manual steps", () => {
    assert.equal(
      shouldAutoLiveSyncManualPlan({
        gbpConnected: false,
        hasManualSteps: true,
      }),
      false
    );
    assert.equal(
      shouldAutoLiveSyncManualPlan({
        gbpConnected: true,
        hasManualSteps: false,
      }),
      false
    );
  });

  it("runs immediately when no prior sync exists", () => {
    assert.equal(
      shouldAutoLiveSyncManualPlan({
        gbpConnected: true,
        hasManualSteps: true,
        lastSyncAt: null,
      }),
      true
    );
  });

  it("respects the cooldown window", () => {
    const now = 1_700_000_000_000;
    assert.equal(
      shouldAutoLiveSyncManualPlan({
        gbpConnected: true,
        hasManualSteps: true,
        lastSyncAt: now - MANUAL_PLAN_SYNC_COOLDOWN_MS + 1,
        now,
      }),
      false
    );
    assert.equal(
      shouldAutoLiveSyncManualPlan({
        gbpConnected: true,
        hasManualSteps: true,
        lastSyncAt: now - MANUAL_PLAN_SYNC_COOLDOWN_MS,
        now,
      }),
      true
    );
  });
});
