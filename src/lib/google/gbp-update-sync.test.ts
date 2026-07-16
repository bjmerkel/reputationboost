import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionTask } from "@/audit/types";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { buildGbpLocationInventory } from "./gbp-location-inventory";
import type { GbpLocationProfile } from "./gbp-location";
import {
  applyGoogleUpdatePatchToAudit,
  rebuildLocationInventoryForAudit,
} from "./gbp-update-sync";
import {
  getGoogleDiffFields,
  getGooglePendingFields,
  hasUnresolvedGoogleDiffs,
  missingGoogleSuggestionTasks,
} from "./gbp-update-helpers";

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
    additionalCategories: [],
    serviceItems: [{ name: "Brake repair" }],
    attributes: [],
    attributeDetails: [],
    hasRegularHours: true,
    hasFullWeekHours: true,
    hasMoreHours: false,
    hasSpecialHours: false,
    hasGoogleUpdated: true,
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
    regularHours: null,
    specialHours: null,
    serviceAreaPlaces: [],
    isServiceAreaBusiness: false,
    businessLatLng: null,
    ...overrides,
  };
}

function auditWithInventory() {
  const audit = createTestAudit();
  const profile = mockProfile({ hasGoogleUpdated: false });
  return {
    ...audit,
    gbp: {
      ...audit.gbp,
      locationInventory: buildGbpLocationInventory({
        collectedAt: audit.gbp.collectedAt,
        source: "oauth",
        profile,
        identity: audit.gbp.identity,
        completeness: audit.gbp.completeness,
        content: audit.gbp.content,
        engagement: audit.gbp.engagement,
        performance: audit.gbp.performance,
        issues: audit.gbp.issues,
      }),
    },
  };
}

function auditWithGoogleUpdate() {
  const audit = createTestAudit();
  return {
    ...audit,
    gbp: {
      ...audit.gbp,
      googleUpdateState: {
        diffMask: "profile.description",
        pendingMask: "",
        diffFields: [
          {
            field: "profile.description",
            label: "Description",
            ownerValue: "Our text",
            googleValue: "Google text",
            kind: "diff" as const,
          },
        ],
        pendingFields: [],
      },
      googleSuggestions: [
        {
          field: "profile.description",
          label: "Description",
          ownerValue: "Our text",
          googleValue: "Google text",
          kind: "diff" as const,
        },
      ],
    },
  };
}

function task(partial: Partial<ExecutionTask>): ExecutionTask {
  return {
    id: "task-1",
    auditId: "audit-1",
    actionItemId: "gbp-step-0",
    type: "gbp_accept_suggestion",
    title: "Accept",
    description: "",
    priority: "P1",
    status: "pending_approval",
    draftContent: "",
    payload: { suggestionField: "profile.description" },
    requiresApproval: true,
    scheduledFor: null,
    completedAt: null,
    result: null,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("gbp-update-sync", () => {
  it("reads diff and pending fields from audit state", () => {
    const payload = auditWithGoogleUpdate();
    assert.equal(getGoogleDiffFields(payload).length, 1);
    assert.equal(getGooglePendingFields(payload).length, 0);
    assert.equal(hasUnresolvedGoogleDiffs(payload), true);
  });

  it("creates missing accept and reject tasks per diff field", () => {
    const payload = auditWithGoogleUpdate();
    const missing = missingGoogleSuggestionTasks(payload, []);
    assert.equal(missing.length, 2);
    assert.ok(missing.some((t) => t.type === "gbp_accept_suggestion"));
    assert.ok(missing.some((t) => t.type === "gbp_reject_suggestion"));
  });

  it("skips tasks that already exist for the same field and type", () => {
    const payload = auditWithGoogleUpdate();
    const missing = missingGoogleSuggestionTasks(payload, [
      task({ type: "gbp_accept_suggestion" }),
    ]);
    assert.equal(missing.length, 1);
    assert.equal(missing[0].type, "gbp_reject_suggestion");
  });

  it("rebuilds location inventory conflicts from live Google update masks", () => {
    const audit = auditWithInventory();
    const googleUpdateState = {
      diffMask: "phoneNumbers.primaryPhone",
      pendingMask: "",
      diffFields: [
        {
          field: "phoneNumbers.primaryPhone",
          label: "Phone",
          ownerValue: "(214) 555-0100",
          googleValue: "(214) 555-9999",
          kind: "diff" as const,
        },
      ],
      pendingFields: [],
    };
    const profile = mockProfile({ hasGoogleUpdated: true, phone: "(214) 555-0100" });

    const inventory = rebuildLocationInventoryForAudit(audit, profile, googleUpdateState);
    const phone = inventory?.fields.find((field) => field.apiPath === "phoneNumbers.primaryPhone");
    assert.equal(phone?.status, "conflict");
    assert.equal(inventory?.summary.conflict, 1);
  });

  it("patches audit google state and location inventory together", () => {
    const audit = auditWithInventory();
    const live = {
      profile: mockProfile({ hasGoogleUpdated: true }),
      googleUpdateState: {
        diffMask: "profile.description",
        pendingMask: "",
        diffFields: [
          {
            field: "profile.description",
            label: "Description",
            ownerValue: "Old",
            googleValue: "New",
            kind: "diff" as const,
          },
        ],
        pendingFields: [],
      },
      googleSuggestions: [],
      hasGoogleUpdated: true,
      noPendingEdits: true,
      resolved: false,
    };

    const patched = applyGoogleUpdatePatchToAudit(audit, live);
    const description = patched.gbp.locationInventory?.fields.find(
      (field) => field.apiPath === "profile.description"
    );
    assert.equal(description?.status, "conflict");
    assert.equal(patched.gbp.hasGoogleUpdated, true);
    assert.equal(patched.gbp.googleUpdateState?.diffMask, "profile.description");
  });
});
