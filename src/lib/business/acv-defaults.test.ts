import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTestAudit } from "@/audit/phase3/test-fixtures";
import {
  defaultAcvPreviewHint,
  estimateTemplateAcv,
  parseLocationFromAddress,
  regionalAcvMultiplier,
  roundAcvDefault,
} from "./acv-defaults";

describe("parseLocationFromAddress", () => {
  it("parses city and state from a comma-separated address", () => {
    const location = parseLocationFromAddress("123 Main St, Dallas, TX 75201");
    assert.equal(location.city, "Dallas");
    assert.equal(location.state, "TX");
  });
});

describe("regionalAcvMultiplier", () => {
  it("applies a premium metro uplift in California", () => {
    assert.equal(regionalAcvMultiplier("CA", "Santa Clara"), 1.2);
  });

  it("applies a moderate uplift for other high-cost states", () => {
    assert.equal(regionalAcvMultiplier("NY", "Buffalo"), 1.12);
  });

  it("uses neutral multipliers for typical markets", () => {
    assert.equal(regionalAcvMultiplier("TX", "Dallas"), 1);
  });
});

describe("estimateTemplateAcv", () => {
  it("infers pool service value from a generic category and business name", () => {
    const value = estimateTemplateAcv({
      businessName: "Freedom Pool Services",
      primaryCategory: "Services",
      city: "Santa Clara",
      state: "CA",
      keywords: ["best pool maintenance Santa Clara"],
    });
    assert.equal(value, 850);
  });

  it("uses home-service defaults for plumbers", () => {
    const value = estimateTemplateAcv({
      businessName: "Lone Star Plumbing",
      primaryCategory: "Plumber",
      city: "Austin",
      state: "TX",
    });
    assert.equal(value, 450);
  });

  it("uses low-ticket defaults for retail", () => {
    const value = estimateTemplateAcv({
      primaryCategory: "Retail store",
      state: "TX",
    });
    assert.equal(value, 80);
  });

  it("uses restaurant defaults for food businesses", () => {
    const value = estimateTemplateAcv({
      primaryCategory: "Restaurant",
      state: "FL",
    });
    assert.equal(value, 45);
  });

  it("infers trades from keywords when the category is vague", () => {
    const value = estimateTemplateAcv({
      businessName: "Main Street Services",
      primaryCategory: "Services",
      keywords: ["emergency roof repair"],
      state: "GA",
    });
    assert.equal(value, 7800);
  });

  it("falls back to a neutral default for unknown categories", () => {
    const value = estimateTemplateAcv({
      businessName: "Acme Consulting",
      primaryCategory: "Consulting",
      state: "TX",
    });
    assert.equal(value, 400);
  });
});

describe("defaultAcvPreviewHint", () => {
  it("uses audit name, category, and tracked keywords", () => {
    const audit = createTestAudit();
    audit.clientName = "Freedom Pool Services";
    audit.gbp.identity.primaryCategory = "Services";
    audit.gbp.identity.address = "404 Martin Ave, Santa Clara, CA 95050";
    audit.rankings.keywords = [
      {
        keyword: "best pool maintenance Santa Clara",
        localPackPosition: 1,
        inLocalPack: true,
        geoRanks: [],
        packLeaderRating: 4.8,
        packLeaderReviewCount: 120,
        clientRating: 4.9,
        clientReviewCount: 289,
      },
    ];

    assert.equal(defaultAcvPreviewHint(audit), 850);
  });
});

describe("roundAcvDefault", () => {
  it("rounds to readable increments", () => {
    assert.equal(roundAcvDefault(87), 85);
    assert.equal(roundAcvDefault(462), 450);
    assert.equal(roundAcvDefault(1837), 1850);
  });
});
