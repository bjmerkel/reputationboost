import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientConfig } from "@/audit/types";
import type { GbpLocationProfile } from "./gbp-location";
import {
  hasPersistedOwnedBusinessIdentity,
  resolveOwnedBusinessCoordinates,
  resolveOwnedBusinessIdentity,
  shouldFetchConnectedPlacesFallback,
} from "./owned-business-resolver";

function client(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return {
    id: "acme",
    name: "Acme Plumbing",
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
    phone: "555-0100",
    website: "https://acme.example",
    ...overrides,
  };
}

function liveProfile(): GbpLocationProfile {
  return {
    locationName: "locations/1",
    title: "Acme Plumbing Live",
    description: "",
    phone: "555-0101",
    additionalPhones: [],
    website: "https://live.acme.example",
    address: "2 Main St, Austin, TX 78701",
    placeId: "live-place",
    mapsUri: "https://maps.example/live",
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
    serviceAreaBusinessType: null,
    moreHoursCount: 0,
    regularHours: null,
    specialHours: null,
    serviceAreaPlaces: [],
    isServiceAreaBusiness: false,
    businessLatLng: null,
  };
}

describe("owned business identity resolution", () => {
  it("prefers live GBP over persisted and Places identity", () => {
    const resolved = resolveOwnedBusinessIdentity(
      client({
        gbpPlaceId: "persisted-place",
        gbpMapsUrl: "https://maps.example/persisted",
        gbpAddress: "Persisted address",
      }),
      {
        liveProfile: liveProfile(),
        place: {
          placeId: "places-place",
          name: "Places name",
          address: "Places address",
          phone: "",
          website: "",
          mapsUrl: "https://maps.example/places",
          rating: 5,
          reviewCount: 10,
          types: ["plumber"],
          businessStatus: "OPERATIONAL",
          description: "",
          hasHours: true,
          hasHolidayHours: false,
          photoCount: 1,
          reviews: [],
          isOperational: true,
        },
      }
    );

    assert.equal(resolved.source, "live_gbp");
    assert.equal(resolved.identity.name, "Acme Plumbing Live");
    assert.equal(resolved.identity.placeId, "live-place");
    assert.deepEqual(resolved.identity.secondaryCategories, ["Drainage service"]);
  });

  it("uses persisted GBP before paid Places fallback", () => {
    const persistedClient = client({
      gbpPlaceId: "persisted-place",
      gbpMapsUrl: "https://maps.example/persisted",
      gbpAddress: "Persisted address",
      gbpSecondaryCategories: ["Drainage service"],
    });

    assert.equal(hasPersistedOwnedBusinessIdentity(persistedClient), true);
    assert.equal(
      shouldFetchConnectedPlacesFallback({
        profileAvailable: false,
        persistedIdentityAvailable: true,
      }),
      false
    );

    const resolved = resolveOwnedBusinessIdentity(persistedClient);
    assert.equal(resolved.source, "persisted_gbp");
    assert.equal(resolved.identity.address, "Persisted address");
  });

  it("uses Places identity only for an unpersisted legacy business", () => {
    const resolved = resolveOwnedBusinessIdentity(client(), {
      place: {
        placeId: "places-place",
        name: "Places Business",
        address: "Places address",
        phone: "555-0199",
        website: "https://places.example",
        mapsUrl: "https://maps.example/places",
        rating: 4.8,
        reviewCount: 100,
        types: ["plumber"],
        businessStatus: "OPERATIONAL",
        description: "",
        hasHours: true,
        hasHolidayHours: false,
        photoCount: 10,
        reviews: [],
        isOperational: true,
      },
    });

    assert.equal(resolved.source, "places");
    assert.equal(resolved.identity.name, "Places Business");
    assert.equal(resolved.identity.phone, "555-0199");
  });

  it("uses GBP service-area coordinates before onboarding coordinates", () => {
    const coordinates = resolveOwnedBusinessCoordinates(
      client({
        gbpServiceArea: {
          version: 1,
          businessType: "CUSTOMER_LOCATION_ONLY",
          places: [],
          businessLatLng: { lat: 30.25, lng: -97.75 },
        },
      })
    );

    assert.deepEqual(coordinates, { lat: 30.25, lng: -97.75 });
  });
});
