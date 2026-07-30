import assert from "node:assert/strict";
import sharp from "sharp";
import { describe, it } from "node:test";
import { buildFlyerDesignBrief } from "./design-brief";
import { compositeFlyerImage } from "./composite";
import { computeFlyerLayout, getFlyerFormatSpec } from "./formats";
import { resolveFlyerCopy } from "./copy";
import { renderFlyerTextOverlay, verifyFlyerFontsAvailable } from "./text-overlay";
import { getArchetypeLayoutTokens } from "./layout-variants";
import { GOLDEN_FLYER_BUSINESSES } from "./test-fixtures";

describe("renderFlyerTextOverlay", () => {
  it("loads bundled fonts for server-side rendering", () => {
    assert.equal(verifyFlyerFontsAvailable(), true);
  });

  it("renders visible copy pixels on the content zone", async () => {
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
        height: 160,
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

describe("compositeFlyerImage", () => {
  it("includes readable headline text in the final portrait composite", async () => {
    const business = GOLDEN_FLYER_BUSINESSES.childcare;
    const brief = buildFlyerDesignBrief({
      guide: business.guide,
      business: business.client,
      publicUrl: business.publicUrl,
      template: "professional",
      format: "letter",
      enrichment: { ...business.enrichment, averageRating: 4.9, reviewCount: 327 },
    });
    brief.copy = resolveFlyerCopy("professional", brief.tagline, "Trusted by local families");

    const background = await sharp({
      create: {
        width: 1024,
        height: 1536,
        channels: 3,
        background: { r: 220, g: 230, b: 240 },
      },
    })
      .png()
      .toBuffer();

    const composite = await compositeFlyerImage({ brief, background });
    const layout = computeFlyerLayout(getFlyerFormatSpec("letter"));

    const { data, info } = await sharp(composite)
      .extract({
        left: Math.round(layout.width * 0.2),
        top: layout.textTop,
        width: Math.round(layout.width * 0.6),
        height: 180,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let darkPixels = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const alpha = info.channels === 4 ? data[i + 3] : 255;
      if (alpha > 0 && data[i] < 235) darkPixels += 1;
    }

    assert.ok(darkPixels > 200, `expected composite headline pixels, got ${darkPixels}`);
  });
});
