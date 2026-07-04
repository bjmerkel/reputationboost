import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeGbpCompletenessScore } from "./completeness";
import { recommendAttributeUpdates } from "@/lib/google/gbp-attribute-recommendations";
import type { GbpAttributeMetadata, GbpLocationAttribute } from "@/lib/google/gbp-location";

describe("computeGbpCompletenessScore", () => {
  it("returns 100 when all checks pass", () => {
    const score = computeGbpCompletenessScore({
      hasHours: true,
      hasFullWeekHours: true,
      hasHolidayHours: true,
      hasDescription: true,
      descriptionLength: 500,
      hasServices: true,
      serviceCount: 4,
      attributeCount: 6,
      hasPhotos: true,
      hasWebsite: true,
      noPendingEdits: true,
    });
    assert.equal(score, 100);
  });

  it("penalizes missing holiday hours and pending edits", () => {
    const score = computeGbpCompletenessScore({
      hasHours: true,
      hasFullWeekHours: true,
      hasHolidayHours: false,
      hasDescription: true,
      descriptionLength: 500,
      hasServices: true,
      serviceCount: 4,
      attributeCount: 6,
      hasPhotos: true,
      hasWebsite: true,
      noPendingEdits: false,
    });
    assert.equal(score, 82);
  });
});

describe("recommendAttributeUpdates", () => {
  const available: GbpAttributeMetadata[] = [
    {
      name: "attributes/has_wheelchair_accessible_entrance",
      displayName: "Wheelchair accessible entrance",
      groupDisplayName: "Accessibility",
      valueType: "BOOL",
      deprecated: false,
    },
    {
      name: "attributes/url_appointment",
      displayName: "Appointment URL",
      groupDisplayName: "Booking",
      valueType: "URL",
      deprecated: false,
    },
    {
      name: "attributes/has_parking",
      displayName: "Parking",
      groupDisplayName: "Amenities",
      valueType: "BOOL",
      deprecated: false,
    },
  ];

  it("recommends BOOL attributes not yet enabled", () => {
    const current: GbpLocationAttribute[] = [];
    const updates = recommendAttributeUpdates(available, current, { limit: 5 });
    assert.ok(updates.length >= 2);
    assert.ok(updates.every((u) => u.boolValue === true || Boolean(u.uri)));
  });

  it("skips already-enabled attributes", () => {
    const current: GbpLocationAttribute[] = [
      {
        name: "attributes/has_wheelchair_accessible_entrance",
        values: ["__BOOL_TRUE__"],
        valueType: "BOOL",
      },
    ];
    const updates = recommendAttributeUpdates(available, current, { limit: 5 });
    assert.ok(!updates.some((u) => u.name.includes("wheelchair")));
  });
});
