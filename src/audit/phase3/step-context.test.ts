import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  keywordsMissingFromText,
  textContainsKeyword,
} from "@/audit/attribution/keywords";
import { buildStepContext } from "./step-context";
import type { FullAuditPayload, GbpPlanStep } from "../types";
import { createTestAudit } from "./test-fixtures";

const CAR_SPA_DESCRIPTION =
  "Car Spa Auto Electronics is your go-to destination in Arlington, VA, for top-notch auto electronic services, " +
  "including CarPlay installations, blindspot sensors, and parking sensors. Our experienced technicians ensure " +
  "high-quality installations tailored to your vehicle's needs. Conveniently located at 3846 S Four Mile Run Dr, " +
  "we pride ourselves on excellent customer service and quality work. Whether you're looking for the best car audio " +
  "systems or need assistance with auto electronics, we have you covered. Visit us today to enhance your driving experience!";

const CAR_SPA_KEYWORDS = [
  "car spa auto electronics arlington",
  "carplay installation arlington va",
  "blindspot sensors near me",
  "parking sensors installation arlington",
  "car repair near me",
];

function carSpaDescriptionStep(overrides: Partial<GbpPlanStep> = {}): GbpPlanStep {
  return {
    stepNumber: 3,
    title: "Rewrite the Business Description",
    instruction: "Rewrite your description.",
    current: `512 characters: "${CAR_SPA_DESCRIPTION.slice(0, 200)}…"`,
    recommended: "Updated description below — includes all target keywords",
    copyBlocks: [
      {
        label: "Recommended description (paste into GBP)",
        content:
          "At Car Spa Auto Electronics, we specialize in providing top-quality auto electronics services in Arlington, VA. " +
          "Our expert team offers professional installations of CarPlay, blindspot sensors, and parking sensors, and auto repair services.",
      },
    ],
    actionData: {
      description:
        "At Car Spa Auto Electronics, we specialize in providing top-quality auto electronics services in Arlington, VA. " +
        "Our expert team offers professional installations of CarPlay, blindspot sensors, and parking sensors, and auto repair services.",
    },
    gbpAction: "update_description",
    ...overrides,
  };
}

function carSpaAudit(): FullAuditPayload {
  const audit = createTestAudit();
  return {
    ...audit,
    clientName: "Car Spa Auto Electronics",
    gbp: {
      ...audit.gbp,
      identity: {
        ...audit.gbp.identity,
        name: "Car Spa Auto Electronics",
        address: "3846 S Four Mile Run Dr, Arlington, VA 22206",
        primaryCategory: "Car stereo store",
      },
      completeness: {
        ...audit.gbp.completeness,
        descriptionLength: CAR_SPA_DESCRIPTION.length,
      },
      liveProfile: {
        ...audit.gbp.liveProfile,
        description: CAR_SPA_DESCRIPTION,
        primaryCategory: "Car stereo store",
      },
    },
    rankings: {
      ...audit.rankings,
      keywords: CAR_SPA_KEYWORDS.map((keyword, index) => ({
        keyword,
        localPackPosition: index === 0 ? 6 : ("not_in_pack" as const),
        inLocalPack: false,
        geoRanks: [{ distanceMiles: 1, rank: 6 + index, inLocalPack: false }],
        packLeaderRating: 4.8,
        packLeaderReviewCount: 120,
        clientRating: 4.7,
        clientReviewCount: 45,
      })),
      totalKeywords: CAR_SPA_KEYWORDS.length,
      keywordsInPack: 0,
    },
    strategy: {
      ...audit.strategy,
      gbpPlan: {
        ...audit.strategy.gbpPlan!,
        targetKeywords: CAR_SPA_KEYWORDS,
        steps: [carSpaDescriptionStep()],
      },
    },
  };
}

describe("textContainsKeyword", () => {
  it("matches keyword concepts without requiring the exact phrase", () => {
    assert.equal(
      textContainsKeyword(CAR_SPA_DESCRIPTION, "carplay installation arlington va"),
      true
    );
    assert.equal(
      textContainsKeyword(CAR_SPA_DESCRIPTION, "blindspot sensors near me"),
      true
    );
    assert.equal(
      textContainsKeyword(CAR_SPA_DESCRIPTION, "parking sensors installation arlington"),
      true
    );
    assert.equal(textContainsKeyword(CAR_SPA_DESCRIPTION, "car repair near me"), false);
  });
});

describe("buildStepContext description step", () => {
  it("uses the live profile description for Current and the draft for Recommended", () => {
    const context = buildStepContext(carSpaAudit(), carSpaDescriptionStep());

    assert.equal(context.currentValue, CAR_SPA_DESCRIPTION);
    assert.match(context.recommendedValue ?? "", /auto repair services/);
    assert.doesNotMatch(context.recommendedValue ?? "", /Updated description below/);
  });

  it("does not claim all keywords are missing when concepts are already covered", () => {
    const context = buildStepContext(carSpaAudit(), carSpaDescriptionStep());

    assert.doesNotMatch(context.expectedEffect, /8 of 8/);
    assert.doesNotMatch(context.expectedEffect, /doesn't cover 5 of 5/);
    assert.match(context.expectedEffect, /car repair near me/i);
  });

  it("flags a meaningful gap when only a few keywords are uncovered", () => {
    const missing = keywordsMissingFromText(CAR_SPA_DESCRIPTION, CAR_SPA_KEYWORDS);
    assert.deepEqual(missing, ["car repair near me"]);

    const context = buildStepContext(carSpaAudit(), carSpaDescriptionStep());
    assert.match(context.expectedEffect, /Almost there/i);
    assert.match(context.expectedEffect, /"car repair near me"/);
  });

  it("prompts for a new description when none exists", () => {
    const audit = carSpaAudit();
    audit.gbp.liveProfile = { ...audit.gbp.liveProfile!, description: "" };

    const context = buildStepContext(audit, carSpaDescriptionStep());
    assert.match(context.expectedEffect, /Add a business description/i);
  });

  it("prioritizes length guidance when the description is too short", () => {
    const audit = carSpaAudit();
    audit.gbp.liveProfile = {
      ...audit.gbp.liveProfile!,
      description: "Short auto electronics blurb in Arlington.",
    };

    const context = buildStepContext(audit, carSpaDescriptionStep());
    assert.match(context.expectedEffect, /characters/i);
    assert.match(context.expectedEffect, /expand/i);
  });
});

describe("buildStepContext priority services step", () => {
  it("recommends GBP services (not products) for outside-pack keywords", () => {
    const audit = carSpaAudit();
    const context = buildStepContext(audit, {
      stepNumber: 5,
      title: "Priority Keyword Services",
      instruction: "Add services for priority keywords.",
      gbpAction: "add_service_items",
    });

    assert.match(context.expectedEffect, /GBP services/i);
    assert.doesNotMatch(context.expectedEffect, /products?/i);
  });
});
