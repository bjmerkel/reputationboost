import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import { parseLocationFromAddress } from "@/lib/business/acv-defaults";
import {
  buildAcvEstimateContext,
  estimateAverageCustomerValue,
} from "@/lib/llm/acv-estimate";

describe("parseLocationFromAddress", () => {
  it("parses city and state from a comma-separated address", () => {
    const location = parseLocationFromAddress("123 Main St, Dallas, TX 75201");
    assert.equal(location.city, "Dallas");
    assert.equal(location.state, "TX");
  });
});

describe("buildAcvEstimateContext", () => {
  it("uses audit category and parsed location", () => {
    const audit = createTestAudit();
    audit.clientName = "Lone Star Plumbing";
    audit.gbp.identity.primaryCategory = "Plumber";
    audit.gbp.identity.address = "100 Oak St, Austin, TX 78701";

    const context = buildAcvEstimateContext(audit, "Home services");
    assert.equal(context.businessName, "Lone Star Plumbing");
    assert.equal(context.primaryCategory, "Plumber");
    assert.equal(context.city, "Austin");
    assert.equal(context.state, "TX");
  });
});

describe("estimateAverageCustomerValue", () => {
  it("returns a template fallback when LLM is not configured", async () => {
    const estimate = await estimateAverageCustomerValue({
      businessName: "Lone Star Plumbing",
      primaryCategory: "Plumber",
      industry: "Plumber",
      city: "Austin",
      state: "TX",
    });

    assert.equal(estimate.source, "template");
    assert.equal(estimate.avgCustomerValue, 450);
    assert.match(estimate.rationale, /plumber/i);
  });

  it("infers pool value from business name when category is generic", async () => {
    const estimate = await estimateAverageCustomerValue({
      businessName: "Freedom Pool Services",
      primaryCategory: "Services",
      industry: "Services",
      city: "Santa Clara",
      state: "CA",
      keywords: ["best pool maintenance Santa Clara"],
    });

    assert.equal(estimate.source, "template");
    assert.equal(estimate.avgCustomerValue, 850);
  });
});
