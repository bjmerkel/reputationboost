import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFlyerDesignBrief } from "./design-brief";
import { computeFlyerLayout, getFlyerFormatSpec } from "./formats";
import { checkFlyerQuality, contrastRatio } from "./quality-check";
import { GOLDEN_FLYER_BUSINESSES } from "./test-fixtures";

describe("flyer quality checks", () => {
  it("flags low QR contrast for light brand colors", () => {
    const business = GOLDEN_FLYER_BUSINESSES.childcare;
    const brief = buildFlyerDesignBrief({
      guide: business.guide,
      business: business.client,
      publicUrl: business.publicUrl,
      template: "professional",
      format: "letter",
      enrichment: business.enrichment,
    });
    brief.primaryColor = "#f5f5f5";

    const report = checkFlyerQuality({
      brief,
      copy: {
        headline: "Love your child's experience?",
        subhead: "Share your experience on Google",
        cta: "Thank you!",
        qrLabel: "Scan to review",
        supportLine: "Child care · Mandeville, LA",
      },
    });

    assert.ok(report.warnings.includes("qr_low_contrast"));
    assert.ok(report.messages.length > 0);
  });

  it("flags crowded copy near the QR zone", () => {
    const business = GOLDEN_FLYER_BUSINESSES.electrician;
    const brief = buildFlyerDesignBrief({
      guide: business.guide,
      business: business.client,
      publicUrl: business.publicUrl,
      template: "professional",
      format: "letter",
      enrichment: business.enrichment,
    });
    const layout = computeFlyerLayout(getFlyerFormatSpec("letter"));
    const tightLayout = { ...layout, qrTop: layout.textTop + 120 };

    const report = checkFlyerQuality({
      brief,
      layout: tightLayout,
      copy: {
        headline: "Great service today?",
        subhead: "Share your experience on Google",
        cta: "Thank you!",
        qrLabel: "Scan to review",
        supportLine: "Electrician · Metairie, LA",
      },
    });

    assert.ok(report.warnings.includes("text_near_qr_zone"));
  });

  it("computes contrast ratio for dark brand colors", () => {
    assert.ok(contrastRatio("#1a73e8", "#ffffff") >= 4.5);
  });
});
