import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  externalIdInReconcileScopes,
  isScanManagedExternalId,
  scanManagedExternalIds,
} from "./gbp-moderation-scan";

describe("gbp-moderation-scan reconcile helpers", () => {
  it("identifies scan-managed external ids", () => {
    assert.equal(isScanManagedExternalId("nightly:pending:serviceItems"), true);
    assert.equal(isScanManagedExternalId("audit:customer-media"), true);
    assert.equal(isScanManagedExternalId("pubsub:evt-1"), false);
    assert.equal(isScanManagedExternalId(null), false);
  });

  it("scopes pending/conflict ids to google-updates reconcile", () => {
    assert.equal(
      externalIdInReconcileScopes("nightly:pending:serviceItems", ["google-updates"]),
      true
    );
    assert.equal(
      externalIdInReconcileScopes("nightly:conflict:storefrontAddress", ["google-updates"]),
      true
    );
    assert.equal(
      externalIdInReconcileScopes("nightly:pending:serviceItems", ["reviews"]),
      false
    );
    assert.equal(
      externalIdInReconcileScopes("pubsub:evt-1", ["google-updates"]),
      false
    );
  });

  it("clears legacy count-suffixed rejected-post ids when posts scope ran", () => {
    assert.equal(
      externalIdInReconcileScopes("audit:rejected-posts:5", ["rejected-posts"]),
      true
    );
    assert.equal(
      externalIdInReconcileScopes("nightly:rejected-posts", ["rejected-posts"]),
      true
    );
  });

  it("collects external ids from recorded events", () => {
    assert.deepEqual(
      scanManagedExternalIds([
        { externalId: "nightly:pending:metadata" },
        { externalId: undefined },
        { externalId: "nightly:rejected-posts" },
      ]),
      ["nightly:pending:metadata", "nightly:rejected-posts"]
    );
  });
});
