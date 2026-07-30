import assert from "node:assert/strict";
import sharp from "sharp";
import { describe, it } from "node:test";
import { buildFlyerDesignBrief } from "./design-brief";
import { computeFlyerLayout, getFlyerFormatSpec } from "./formats";
import { renderFlyerTextOverlay } from "./text-overlay-canvas";
import { getArchetypeLayoutTokens } from "./layout-variants";
import { GOLDEN_FLYER_BUSINESSES } from "./test-fixtures";

describe("renderFlyerTextOverlay", () => {
  it("renders visible copy pixels on the content card", async () => {
    const business = GOLDEN_FLYER_BUSINESSES.childcare;
    const brief = buildFlyerDesignBrief({
      guide: business.guide,
      business: business.client,
      publicUrl: business.publicUrl,
      template: "professional",
      format: "letter",
      enrichment: { ...business.enrichment, averageRating: 4.9, reviewCount: 327 },
    });
    const layout = computeFlyerLayout(getFlyerFormatSpec("letter"));
    const tokens = getArchetypeLayoutTokens(brief.archetype);

    const overlay = renderFlyerTextOverlay({
      layout,
      tokens,
      brief,
      copy: {
        headline: "Love your experience at Northshore?",
        subhead:
          "Your feedback helps other families discover a safe, caring place to learn, play, and grow.",
        cta: "Thank you for supporting Northshore Learning Center!",
        qrLabel: "Scan the QR code with your phone",
        supportLine: "Trusted by local families",
      },
      footer: "Mandeville, LA · (504) 555-0100",
      eyebrow: "Learn • Play • Grow",
      address: null,
      showStars: true,
    });

    const { data, info } = await sharp(overlay)
      .extract({
        left: Math.round(layout.width * 0.25),
        top: layout.textTop,
        width: Math.round(layout.width * 0.5),
        height: 120,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let darkPixels = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const alpha = info.channels === 4 ? data[i + 3] : 255;
      if (alpha > 0 && data[i] < 240) darkPixels += 1;
    }

    assert.ok(darkPixels > 100, `expected rendered text pixels, got ${darkPixels}`);
  });
});
