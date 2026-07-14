import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGbpLocationPatch } from "./businesses";

const existing = {
  gbp_place_id: "old-place",
  gbp_maps_url: "https://maps.example/old",
  gbp_address: "1 Main St, Austin, TX 78701",
  gbp_open_status: "OPEN",
  gbp_secondary_categories: ["Old category"],
  gbp_service_area: null,
  location: {
    address: "1 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    lat: 30,
    lng: -97,
  },
};

describe("buildGbpLocationPatch", () => {
  it("persists GBP identity and merges authoritative coordinates", () => {
    const patch = buildGbpLocationPatch(
      existing,
      {
        accountId: "account-1",
        locationId: "location-1",
        placeId: "new-place",
        mapsUrl: "https://maps.example/new",
        address: "2 Main St, Austin, TX 78701",
        openStatus: "CLOSED_TEMPORARILY",
        secondaryCategories: ["Drainage service"],
        serviceArea: {
          version: 1,
          businessType: "CUSTOMER_AND_BUSINESS_LOCATION",
          places: [{ placeId: "area-1", placeName: "Austin" }],
          businessLatLng: { lat: 30.25, lng: -97.75 },
        },
        businessLatLng: { lat: 30.25, lng: -97.75 },
      },
      "2026-07-14T00:00:00.000Z"
    );

    assert.equal(patch.gbp_place_id, "new-place");
    assert.equal(patch.gbp_maps_url, "https://maps.example/new");
    assert.equal(patch.gbp_address, "2 Main St, Austin, TX 78701");
    assert.equal(patch.gbp_open_status, "CLOSED_TEMPORARILY");
    assert.deepEqual(patch.gbp_secondary_categories, ["Drainage service"]);
    assert.deepEqual(patch.location, {
      ...existing.location,
      lat: 30.25,
      lng: -97.75,
    });
  });

  it("preserves stored identity when enrichment is unavailable", () => {
    const patch = buildGbpLocationPatch(existing, {
      accountId: "account-1",
      locationId: "location-1",
    });

    assert.equal(patch.gbp_place_id, "old-place");
    assert.equal(patch.gbp_maps_url, "https://maps.example/old");
    assert.equal(patch.gbp_address, "1 Main St, Austin, TX 78701");
    assert.equal(patch.gbp_open_status, "OPEN");
    assert.deepEqual(patch.gbp_secondary_categories, ["Old category"]);
    assert.equal("location" in patch, false);
  });
});
