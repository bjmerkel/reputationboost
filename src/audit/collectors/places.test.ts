import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientConfig } from "../types";
import { gridStorageBusinessId } from "./places";

function client(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return {
    id: "business-slug",
    businessId: "9dca13d5-82a1-4824-9084-c11cf5837e64",
    name: "Acme",
    industry: "Plumber",
    location: {
      address: "1 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      lat: 30,
      lng: -97,
    },
    keywords: ["plumber"],
    ...overrides,
  };
}

describe("gridStorageBusinessId", () => {
  it("uses the database UUID rather than the business slug", () => {
    assert.equal(
      gridStorageBusinessId(client()),
      "9dca13d5-82a1-4824-9084-c11cf5837e64"
    );
  });

  it("does not reuse persisted grids for previews", () => {
    assert.equal(gridStorageBusinessId(client({ id: "preview" })), null);
  });
});
