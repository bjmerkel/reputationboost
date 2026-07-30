import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GBP_IDENTITY_COLUMN_KEYS,
  isGbpIdentityColumnSchemaError,
  withoutGbpIdentityColumns,
} from "./gbp-identity-schema";

describe("gbp-identity-schema", () => {
  it("detects PostgREST missing-column errors for GBP identity fields", () => {
    assert.equal(
      isGbpIdentityColumnSchemaError(
        "Could not find the 'gbp_address' column of 'businesses' in the schema cache"
      ),
      true
    );
    assert.equal(isGbpIdentityColumnSchemaError("permission denied"), false);
  });

  it("strips GBP identity columns from update patches", () => {
    const patch = {
      gbp_location_id: "loc-1",
      gbp_address: "1 Main St",
      gbp_open_status: "OPEN",
      gbp_secondary_categories: ["Plumber"],
      gbp_service_area: { version: 1 },
      onboarding_complete: true,
    };

    const legacy = withoutGbpIdentityColumns(patch);
    assert.equal(legacy.gbp_location_id, "loc-1");
    assert.equal(legacy.onboarding_complete, true);
    for (const key of GBP_IDENTITY_COLUMN_KEYS) {
      assert.equal(key in legacy, false);
    }
  });
});
