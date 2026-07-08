import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpAttributeCoverage } from "@/audit/types";
import type { GbpLocationProfile } from "./gbp-location";
import { buildAttributeCoverage } from "./gbp-attribute-recommendations";
import { buildGbpLocationInventory } from "./gbp-location-inventory";

function mockProfile(overrides: Partial<GbpLocationProfile> = {}): GbpLocationProfile {
  return {
    locationName: "locations/123",
    title: "Acme Auto Repair",
    description: "Trusted auto repair in Dallas with 20 years of experience serving local drivers.",
    phone: "(214) 555-0100",
    additionalPhones: [],
    website: "https://acme.example",
    address: "123 Main St, Dallas, TX 75201",
    placeId: "ChIJtest",
    mapsUri: "https://maps.google.com",
    primaryCategory: { name: "categories/gcid:car_repair", displayName: "Auto repair shop" },
    additionalCategories: [{ name: "categories/gcid:oil_change", displayName: "Oil change service" }],
    serviceItems: [
      { name: "Brake repair", description: "Full brake service" },
      { name: "Oil change", description: "Synthetic oil change" },
      { name: "Diagnostics", description: "Engine diagnostics" },
    ],
    attributes: ["Wheelchair accessible", "Accepts credit cards"],
    attributeDetails: [],
    hasRegularHours: true,
    hasFullWeekHours: true,
    hasMoreHours: false,
    hasSpecialHours: true,
    hasGoogleUpdated: false,
    hasPendingEdits: false,
    canModifyServiceList: true,
    canOperateLocalPost: true,
    hasVoiceOfMerchant: true,
    duplicateLocation: null,
    newReviewUri: null,
    openStatus: "OPEN",
    canReopen: null,
    openingDate: null,
    serviceAreaBusinessType: null,
    moreHoursCount: 0,
    regularHours: {
      periods: [
        {
          openDay: "MONDAY",
          closeDay: "MONDAY",
          openTime: { hours: 8, minutes: 0 },
          closeTime: { hours: 17, minutes: 0 },
        },
      ],
    },
    specialHours: { specialHourPeriods: [{ startDate: { year: 2026, month: 12, day: 25 }, closed: true }] },
    serviceAreaPlaces: [],
    isServiceAreaBusiness: false,
    businessLatLng: null,
    ...overrides,
  };
}

const baseInput = {
  collectedAt: "2026-07-06T12:00:00.000Z",
  source: "oauth" as const,
  identity: {
    name: "Acme Auto Repair",
    address: "123 Main St, Dallas, TX 75201",
    phone: "(214) 555-0100",
    website: "https://acme.example",
    primaryCategory: "Auto repair shop",
    secondaryCategories: ["Oil change service"],
    placeId: "ChIJtest",
    mapsUrl: "https://maps.google.com",
  },
  completeness: {
    hasHours: true,
    hasFullWeekHours: true,
    hasHolidayHours: true,
    hasDescription: true,
    descriptionLength: 72,
    hasServices: true,
    serviceCount: 3,
    attributeCount: 2,
    noPendingEdits: true,
    completenessScore: 82,
  },
  content: {
    photoCount: 24,
    videoCount: 1,
    photosByType: {},
    lastPhotoUpload: null,
    postCount: 2,
    lastPostDate: "2026-06-28T00:00:00.000Z",
  },
  engagement: {
    reviewCount: 45,
    averageRating: 4.7,
    reviewsLast30Days: 3,
    reviewsLast90Days: 10,
    responseRate: 0.95,
    avgResponseTimeHours: 0,
  },
  performance: {
    calls: 12,
    directionRequests: 30,
    websiteClicks: 8,
    profileViews: 400,
    impressionsMaps: 1200,
    impressionsSearch: 800,
    conversations: 0,
    bookings: 0,
    periodDays: 30,
    source: "api" as const,
  },
  issues: {
    isSuspended: false,
    isVerified: true,
    hasDuplicateListings: false,
    napInconsistencies: [],
  },
};

describe("gbp-location-inventory", () => {
  it("builds inventory fields for core Location API paths", () => {
    const inventory = buildGbpLocationInventory({
      ...baseInput,
      profile: mockProfile(),
    });

    assert.ok(inventory.fields.length >= 20);
    assert.ok(inventory.fields.some((f) => f.apiPath === "profile.description"));
    assert.ok(inventory.fields.some((f) => f.apiPath === "regularHours"));
    assert.ok(inventory.fields.some((f) => f.apiPath === "serviceItems"));
    assert.ok(inventory.fields.some((f) => f.apiPath === "metadata.hasVoiceOfMerchant"));
    assert.ok(inventory.fields.some((f) => f.apiPath === "performance.actions"));
  });

  it("marks profile.description as conflict when in diffMask", () => {
    const inventory = buildGbpLocationInventory({
      ...baseInput,
      profile: mockProfile({ hasGoogleUpdated: true }),
      googleUpdateState: {
        diffMask: "profile.description",
        pendingMask: "",
        diffFields: [],
        pendingFields: [],
      },
    });

    const description = inventory.fields.find((f) => f.apiPath === "profile.description");
    assert.equal(description?.status, "conflict");
    assert.equal(description?.hasConflict, true);
    assert.equal(inventory.summary.conflict, 1);
  });

  it("flags short descriptions as needs_work", () => {
    const inventory = buildGbpLocationInventory({
      ...baseInput,
      profile: mockProfile({ description: "Short desc" }),
      completeness: {
        ...baseInput.completeness,
        descriptionLength: 10,
      },
    });

    const description = inventory.fields.find((f) => f.apiPath === "profile.description");
    assert.equal(description?.status, "needs_work");
  });

  it("includes service area places when present", () => {
    const inventory = buildGbpLocationInventory({
      ...baseInput,
      profile: mockProfile({
        isServiceAreaBusiness: true,
        serviceAreaBusinessType: "CUSTOMER_LOCATION_ONLY",
        serviceAreaPlaces: [
          { placeId: "p1", placeName: "Dallas, TX" },
          { placeId: "p2", placeName: "Plano, TX" },
        ],
      }),
    });

    const serviceArea = inventory.fields.find((f) => f.apiPath === "serviceArea");
    assert.match(serviceArea?.current ?? "", /Dallas/);
    assert.equal(serviceArea?.status, "good");
  });

  it("summarizes field statuses", () => {
    const inventory = buildGbpLocationInventory({
      ...baseInput,
      profile: mockProfile({ description: "", hasRegularHours: false, hasFullWeekHours: false }),
      completeness: {
        ...baseInput.completeness,
        hasDescription: false,
        descriptionLength: 0,
        hasHours: false,
        hasFullWeekHours: false,
      },
    });

    assert.ok(inventory.summary.missing > 0 || inventory.summary.needsWork > 0);
    assert.equal(inventory.summary.total, inventory.fields.length);
    assert.ok((inventory.summary.potentialScoreGain ?? 0) >= 0);
  });

  it("lists missing attributes and marks the field as needs_work when coverage has gaps", () => {
    const available = [
      {
        name: "attributes/has_onsite_services",
        displayName: "Onsite services",
        groupDisplayName: "Service options",
        valueType: "BOOL",
        deprecated: false,
      },
      {
        name: "attributes/identifies_as_women_owned",
        displayName: "Identifies as women-owned",
        groupDisplayName: "From the business",
        valueType: "BOOL",
        deprecated: false,
      },
      {
        name: "attributes/has_online_appointments",
        displayName: "Online appointments",
        groupDisplayName: "Planning",
        valueType: "BOOL",
        deprecated: false,
      },
      {
        name: "attributes/payment_options",
        displayName: "Payment options",
        groupDisplayName: "Payments",
        valueType: "REPEATED_ENUM",
        deprecated: false,
      },
    ];
    const current = [
      {
        name: "attributes/has_onsite_services",
        valueType: "BOOL",
        values: ["__BOOL_TRUE__"],
      },
      {
        name: "attributes/identifies_as_women_owned",
        valueType: "BOOL",
        values: ["__BOOL_TRUE__"],
      },
    ];
    const attributeCoverage: GbpAttributeCoverage = buildAttributeCoverage(available, current);

    const inventory = buildGbpLocationInventory({
      ...baseInput,
      profile: mockProfile({
        attributes: ["Onsite services", "Identifies as women-owned"],
      }),
      attributeCoverage,
    });

    const attributes = inventory.fields.find((field) => field.apiPath === "attributes");
    assert.equal(attributes?.status, "needs_work");
    assert.match(attributes?.current ?? "", /2 of 4 enabled/);
    assert.match(attributes?.missingCurrent ?? "", /Not enabled \(2\):/);
    assert.match(attributes?.missingCurrent ?? "", /Online appointments/);
    assert.match(attributes?.missingCurrent ?? "", /Payment options/);
    assert.match(attributes?.constraint ?? "", /1 can be enabled · 2 links to add · 1 need manual setup in Google/);
  });
});
