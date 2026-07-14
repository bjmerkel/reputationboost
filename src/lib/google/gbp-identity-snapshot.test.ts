import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gbpIdentitySnapshotFromProfile,
} from "./gbp-identity-snapshot";
import type { GbpLocationProfile } from "./gbp-location";

function profile(): GbpLocationProfile {
  return {
    locationName: "locations/123",
    title: "Acme Plumbing",
    description: "Local plumbers",
    phone: "555-0100",
    additionalPhones: [],
    website: "https://acme.example",
    address: "1 Main St, Austin, TX 78701",
    placeId: "place-123",
    mapsUri: "https://maps.google.com/?cid=123",
    primaryCategory: { name: "gcid:plumber", displayName: "Plumber" },
    additionalCategories: [
      { name: "gcid:drainage_service", displayName: "Drainage service" },
    ],
    serviceItems: [],
    attributes: [],
    attributeDetails: [],
    hasRegularHours: true,
    hasFullWeekHours: true,
    hasMoreHours: false,
    hasSpecialHours: false,
    hasGoogleUpdated: false,
    hasPendingEdits: false,
    canModifyServiceList: true,
    canOperateLocalPost: true,
    hasVoiceOfMerchant: true,
    duplicateLocation: null,
    newReviewUri: null,
    openStatus: "OPEN",
    canReopen: false,
    openingDate: null,
    serviceAreaBusinessType: "CUSTOMER_AND_BUSINESS_LOCATION",
    moreHoursCount: 0,
    regularHours: null,
    specialHours: null,
    serviceAreaPlaces: [{ placeId: "area-1", placeName: "Austin" }],
    isServiceAreaBusiness: true,
    businessLatLng: { lat: 30.2672, lng: -97.7431 },
  };
}

describe("gbpIdentitySnapshotFromProfile", () => {
  it("normalizes free GBP identity fields for persistence", () => {
    const snapshot = gbpIdentitySnapshotFromProfile(profile());

    assert.equal(snapshot.placeId, "place-123");
    assert.equal(snapshot.mapsUrl, "https://maps.google.com/?cid=123");
    assert.equal(snapshot.primaryCategory, "Plumber");
    assert.deepEqual(snapshot.secondaryCategories, ["Drainage service"]);
    assert.equal(snapshot.openStatus, "OPEN");
    assert.deepEqual(snapshot.businessLatLng, { lat: 30.2672, lng: -97.7431 });
    assert.deepEqual(snapshot.serviceArea, {
      version: 1,
      businessType: "CUSTOMER_AND_BUSINESS_LOCATION",
      places: [{ placeId: "area-1", placeName: "Austin" }],
      businessLatLng: { lat: 30.2672, lng: -97.7431 },
    });
  });
});
