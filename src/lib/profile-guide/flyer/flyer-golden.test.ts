import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveFlyerDesignArchetype } from "./archetypes";
import { buildFlyerDesignBrief } from "./design-brief";
import { computeFlyerLayout, getFlyerFormatSpec } from "./formats";
import { buildFlyerBackgroundPromptTemplate } from "./prompt-template";
import { FLYER_PROMPT_VERSION } from "./prompt-version";
import { GOLDEN_FLYER_BUSINESSES } from "./test-fixtures";

describe("golden flyer businesses", () => {
  for (const business of Object.values(GOLDEN_FLYER_BUSINESSES)) {
    it(`resolves archetype for ${business.id}`, () => {
      const archetype = resolveFlyerDesignArchetype({
        primaryCategory: business.enrichment.primaryCategory ?? business.client.industry,
        industry: business.client.industry,
        categories: business.client.gbpSecondaryCategories ?? [],
        keywords: business.client.keywords ?? [],
      });
      assert.equal(archetype, business.expectedArchetype);
    });

    it(`builds prompt template for ${business.id}`, () => {
      const brief = buildFlyerDesignBrief({
        guide: business.guide,
        business: business.client,
        publicUrl: business.publicUrl,
        template: "professional",
        format: "letter",
        enrichment: business.enrichment,
      });

      const prompt = buildFlyerBackgroundPromptTemplate(brief);
      assert.match(prompt, new RegExp(business.client.name, "i"));
      assert.match(prompt, /Do NOT include any text/i);
      assert.equal(FLYER_PROMPT_VERSION, "6.2.0");
    });

    it(`keeps QR inside content zone for ${business.id}`, () => {
      const layout = computeFlyerLayout(getFlyerFormatSpec("letter"));
      const qrBottom = layout.qrTop + layout.qrCardSize;
      const cardBottom = layout.contentCardTop + layout.contentCardHeight;
      assert.ok(layout.qrTop >= layout.contentCardTop);
      assert.ok(qrBottom <= cardBottom + 2);
    });
  }
});
