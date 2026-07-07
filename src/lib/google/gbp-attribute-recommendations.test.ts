import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attributeDisplayName,
  buildAttributeCoverage,
  chunkAttributeUpdates,
  recommendAttributeUpdates,
} from "@/lib/google/gbp-attribute-recommendations";
import { buildAttributePlanContent } from "@/audit/phase2/gbp-current-state";
import { buildAttributeExecutionTasks } from "@/audit/phase3/gbp-plan-tasks";
import { buildStepContext } from "@/audit/phase3/step-context";
import type { FullAuditPayload } from "@/audit/types";
import { createTestAudit } from "@/audit/phase3/test-fixtures";

const available = [
  {
    name: "attributes/has_wheelchair_accessible_entrance",
    displayName: "Wheelchair accessible entrance",
    groupDisplayName: "Accessibility",
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
    name: "attributes/url_appointment",
    displayName: "Appointment links",
    groupDisplayName: "Planning",
    valueType: "URL",
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
    name: "attributes/has_wheelchair_accessible_entrance",
    valueType: "BOOL",
    values: ["__BOOL_TRUE__"],
  },
];

describe("buildAttributeCoverage", () => {
  it("lists missing attributes and auto-applicable updates", () => {
    const coverage = buildAttributeCoverage(available, current, {
      websiteUri: "https://example.com/book",
    });

    assert.equal(coverage.enabledCount, 1);
    assert.equal(coverage.availableCount, 4);
    assert.equal(coverage.missingCount, 3);
    assert.equal(coverage.autoUpdates.length, 2);
    assert.deepEqual(
      coverage.autoUpdates.map((update) => update.name),
      ["attributes/has_online_appointments", "attributes/url_appointment"]
    );
    assert.equal(
      coverage.missing.find((item) => item.displayName === "Payment options")?.autoApplicable,
      false
    );
  });

  it("keeps recommendAttributeUpdates limited when requested", () => {
    const updates = recommendAttributeUpdates(available, current, { limit: 1 });
    assert.equal(updates.length, 1);
  });
});

describe("attribute plan integration", () => {
  function auditWithCoverage(): FullAuditPayload {
    const audit = createTestAudit();
    const coverage = buildAttributeCoverage(available, current, {
      websiteUri: audit.gbp.identity.website,
    });
    return {
      ...audit,
      gbp: {
        ...audit.gbp,
        attributeCoverage: coverage,
        completeness: {
          ...audit.gbp.completeness,
          attributeCount: coverage.enabledCount,
        },
      },
    };
  }

  it("builds a plan step that names missing attributes", () => {
    const planContent = buildAttributePlanContent(auditWithCoverage());
    assert.match(planContent.current, /1 of 4 enabled/);
    assert.match(planContent.recommended, /Enable 2 missing attributes/);
    assert.equal(planContent.actionData?.attributes.length, 2);
    assert.ok(planContent.copyBlocks?.some((block) => block.label.includes("One-click")));
    assert.ok(planContent.copyBlocks?.some((block) => block.label.includes("Set manually")));
  });

  it("creates execution tasks for auto and manual attribute gaps", () => {
    const audit = auditWithCoverage();
    const tasks = buildAttributeExecutionTasks(audit, {
      stepNumber: 13,
      title: "Attributes",
      instruction: "Enable attributes",
      gbpAction: "update_attributes",
      actionData: { attributes: audit.gbp.attributeCoverage!.autoUpdates },
    });

    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].type, "gbp_attributes");
    assert.equal(tasks[1].type, "gbp_checklist");
    assert.ok(Array.isArray(tasks[0].payload.attributes));
  });

  it("explains the reputation score impact in step context", () => {
    const context = buildStepContext(auditWithCoverage(), {
      stepNumber: 13,
      title: "Attributes",
      instruction: "Enable attributes",
      gbpAction: "update_attributes",
    });

    assert.match(context.expectedEffect, /missing 3 of 4 available attributes/i);
    assert.match(context.expectedEffect, /Reputation Boost Score/i);
  });
});

describe("attributeDisplayName", () => {
  it("resolves display names from coverage", () => {
    const coverage = buildAttributeCoverage(available, current);
    assert.equal(
      attributeDisplayName(coverage, "attributes/has_online_appointments"),
      "Online appointments"
    );
  });
});

describe("chunkAttributeUpdates", () => {
  it("splits large update sets into batches", () => {
    const updates = Array.from({ length: 30 }, (_, index) => ({
      name: `attributes/item_${index}`,
      boolValue: true,
    }));
    const batches = chunkAttributeUpdates(updates);
    assert.equal(batches.length, 2);
    assert.equal(batches[0].length, 25);
    assert.equal(batches[1].length, 5);
  });
});
