import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attributeDisplayName,
  buildAttributeCoverage,
  buildUserUriAttributeUpdates,
  chunkAttributeUpdates,
  isProfileLinkCoverageItem,
  isUriAttributeType,
  profileLinkUriPlaceholder,
  resolveProfileLinkMissing,
  recommendAttributeUpdates,
  suggestUriForAttribute,
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
  {
    name: "attributes/url_linkedin",
    displayName: "Linkedin",
    groupDisplayName: "Place page URLs",
    valueType: "URL",
    deprecated: false,
  },
  {
    name: "attributes/url_whatsapp",
    displayName: "WhatsApp",
    groupDisplayName: "Place page URLs",
    valueType: "URL",
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
    assert.equal(coverage.availableCount, 6);
    assert.equal(coverage.missingCount, 5);
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
    assert.match(planContent.current, /1 of 6 enabled/);
    assert.match(planContent.recommended, /Enable 2 missing attributes/);
    assert.equal(planContent.actionData?.attributes.length, 2);
    assert.ok(planContent.copyBlocks?.some((block) => block.label.includes("One-click")));
    assert.ok(planContent.copyBlocks?.some((block) => block.label.includes("Profile links")));
    assert.ok(planContent.copyBlocks?.some((block) => block.label.includes("Set manually")));
  });

  it("includes Facebook and Instagram in profile link gaps when not configured", () => {
    const coverage = buildAttributeCoverage(available, current, {
      websiteUri: "https://example.com/book",
    });

    assert.ok(
      coverage.profileLinkMissing.some((item) => item.displayName === "Facebook"),
      "Facebook should appear in profile link gaps"
    );
    assert.ok(
      coverage.profileLinkMissing.some((item) => item.displayName === "Instagram"),
      "Instagram should appear in profile link gaps"
    );
    assert.ok(
      coverage.profileLinkMissing.some((item) => item.displayName === "Linkedin"),
      "LinkedIn should remain in profile link gaps"
    );
  });

  it("suggests Facebook and Instagram URL prefixes", () => {
    assert.equal(
      suggestUriForAttribute({ name: "attributes/url_facebook", displayName: "Facebook" }),
      "https://www.facebook.com/"
    );
    assert.equal(
      suggestUriForAttribute({ name: "attributes/url_instagram", displayName: "Instagram" }),
      "https://www.instagram.com/"
    );
    assert.equal(
      profileLinkUriPlaceholder({ name: "attributes/url_facebook", displayName: "Facebook" }),
      "https://www.facebook.com/your-page"
    );
  });

  it("resolves Facebook and Instagram onto older audits missing profileLinkMissing entries", () => {
    const coverage = buildAttributeCoverage(available, current, {
      websiteUri: "https://example.com/book",
    });
    const legacyCoverage = {
      ...coverage,
      profileLinkMissing: coverage.profileLinkMissing.filter(
        (item) => item.displayName !== "Facebook" && item.displayName !== "Instagram"
      ),
    };

    const resolved = resolveProfileLinkMissing(legacyCoverage);

    assert.equal(resolved.length, 4);
    assert.ok(resolved.some((item) => item.displayName === "Facebook"));
    assert.ok(resolved.some((item) => item.displayName === "Instagram"));
    assert.ok(resolved.some((item) => item.displayName === "Linkedin"));
    assert.ok(resolved.some((item) => item.displayName === "WhatsApp"));
  });

  it("creates execution tasks for auto, URI, and manual attribute gaps", () => {
    const audit = auditWithCoverage();
    const tasks = buildAttributeExecutionTasks(audit, {
      stepNumber: 13,
      title: "Attributes",
      instruction: "Enable attributes",
      gbpAction: "update_attributes",
      actionData: { attributes: audit.gbp.attributeCoverage!.autoUpdates },
    });

    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].type, "gbp_attributes");
    assert.equal(tasks[1].type, "gbp_attributes");
    assert.match(tasks[1].title, /Add profile links/);
    assert.equal(tasks[1].payload.requiresUriInput, true);
    assert.equal(tasks[2].type, "gbp_checklist");
    assert.ok(Array.isArray(tasks[0].payload.attributes));
    assert.ok(Array.isArray(tasks[1].payload.attributes));
    assert.equal((tasks[1].payload.attributes as unknown[]).length, 4);
  });

  it("suggests WhatsApp links from the business phone", () => {
    const uri = suggestUriForAttribute(
      { name: "attributes/url_whatsapp", displayName: "WhatsApp" },
      { phone: "(214) 555-0100" }
    );
    assert.equal(uri, "https://wa.me/2145550100");
  });

  it("builds URI attribute updates for profile links", () => {
    const coverage = buildAttributeCoverage(available, current, {
      websiteUri: "https://example.com/book",
    });
    const updates = buildUserUriAttributeUpdates(coverage.profileLinkMissing, {
      phone: "(214) 555-0100",
    });

    assert.equal(updates.length, 4);
    assert.ok(updates.some((update) => update.name === "attributes/url_facebook"));
    assert.ok(updates.some((update) => update.name === "attributes/url_instagram"));
    assert.ok(updates.some((update) => update.name === "attributes/url_linkedin"));
    assert.equal(
      updates.find((update) => update.name === "attributes/url_whatsapp")?.uri,
      "https://wa.me/2145550100"
    );
  });

  it("explains the reputation score impact in step context", () => {
    const context = buildStepContext(auditWithCoverage(), {
      stepNumber: 13,
      title: "Attributes",
      instruction: "Enable attributes",
      gbpAction: "update_attributes",
    });

    assert.match(context.expectedEffect, /missing 5 of 6 available attributes/i);
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
