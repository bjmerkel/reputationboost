import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFlyerBrief } from "./brief";
import { buildFlyerBackgroundRequestBody } from "./generate-image";
import { buildFallbackFlyerImagePrompt } from "./prompt";
import {
  computeFlyerLayout,
  FLYER_FORMAT_SPECS,
  parseProfileGuideFlyerFormat,
} from "./formats";
import type { ClientConfig } from "@/audit/types";
import type { ProfileGuideWithLinks } from "../types";

function sampleGuide(): ProfileGuideWithLinks {
  return {
    guide: {
      id: "guide-1",
      business_id: "biz-1",
      user_id: "user-1",
      slug: "acme-plumbing",
      display_name: "Acme Plumbing",
      published: true,
      published_at: null,
      primary_color: "#1a73e8",
      background_color: "#f8f9fa",
      button_style: "rounded",
      font_preset: "professional",
      logo_url: null,
      background_image_url: null,
      tagline: "Your trusted local plumber",
      text_message: null,
      gbp_synced_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    links: [],
  };
}

function sampleBusiness(): ClientConfig {
  return {
    id: "client-1",
    businessId: "biz-1",
    name: "Acme Plumbing",
    industry: "Plumber",
    gbpSecondaryCategories: ["Water heater repair"],
    location: {
      address: "1 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      lat: 0,
      lng: 0,
    },
    keywords: ["emergency plumber", "drain cleaning"],
    phone: "+15125550100",
    website: "https://acme.example",
  };
}

describe("buildFlyerBrief", () => {
  it("maps guide and business fields including categories and keywords", () => {
    const brief = buildFlyerBrief(
      sampleGuide(),
      sampleBusiness(),
      "https://example.com/g/acme-plumbing",
      "professional",
      "story"
    );

    assert.equal(brief.businessName, "Acme Plumbing");
    assert.equal(brief.industry, "Plumber");
    assert.equal(brief.city, "Austin");
    assert.equal(brief.template, "professional");
    assert.equal(brief.format, "story");
    assert.equal(brief.displayOptions.showPhone, true);
    assert.deepEqual(brief.categories, ["Plumber", "Water heater repair"]);
    assert.deepEqual(brief.keywords, ["emergency plumber", "drain cleaning"]);
  });
});

describe("parseProfileGuideFlyerFormat", () => {
  it("defaults to letter for unknown values", () => {
    assert.equal(parseProfileGuideFlyerFormat("invalid"), "letter");
    assert.equal(parseProfileGuideFlyerFormat("postcard"), "postcard");
  });
});

describe("computeFlyerLayout", () => {
  it("uses landscape positions for postcard format", () => {
    const layout = computeFlyerLayout(FLYER_FORMAT_SPECS.postcard);
    assert.equal(layout.orientation, "landscape");
    assert.ok(layout.qrLeft > layout.width / 2);
  });
});

describe("buildFallbackFlyerImagePrompt", () => {
  it("includes business context and forbids text overlays", () => {
    const prompt = buildFallbackFlyerImagePrompt(
      buildFlyerBrief(
        sampleGuide(),
        sampleBusiness(),
        "https://example.com/g/acme-plumbing",
        "friendly",
        "a4"
      )
    );

    assert.match(prompt, /Acme Plumbing/i);
    assert.match(prompt, /Do not include any text/i);
    assert.match(prompt, /drain cleaning/i);
  });
});

describe("buildFlyerBackgroundRequestBody", () => {
  it("requests format-specific dimensions for gpt-image models", () => {
    const body = buildFlyerBackgroundRequestBody(
      "A warm flyer background",
      "gpt-image-2",
      FLYER_FORMAT_SPECS.story
    );

    assert.equal(body.size, "1080x1920");
    assert.equal(body.quality, "high");
    assert.equal(body.response_format, undefined);
  });
});
