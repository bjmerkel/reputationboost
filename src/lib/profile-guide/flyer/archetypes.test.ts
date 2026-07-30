import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveFlyerDesignArchetype } from "./archetypes";
import { buildFlyerDesignBrief } from "./design-brief";
import { buildFlyerBackgroundPromptTemplate } from "./prompt-template";
import type { ClientConfig } from "@/audit/types";
import type { ProfileGuideWithLinks } from "../types";

function sampleGuide(): ProfileGuideWithLinks {
  return {
    guide: {
      id: "guide-1",
      business_id: "biz-1",
      user_id: "user-1",
      slug: "northshore-learning",
      display_name: "Northshore Learning Center",
      published: true,
      published_at: null,
      primary_color: "#1a73e8",
      background_color: "#f8f9fa",
      button_style: "rounded",
      font_preset: "professional",
      logo_url: null,
      background_image_url: null,
      tagline: "Learn, Play, and Grow",
      text_message: null,
      gbp_synced_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    links: [
      {
        id: "link-1",
        guide_id: "guide-1",
        link_type: "review",
        label: "Leave a Review",
        url: "https://example.com/review",
        sort_order: 0,
        enabled: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

function sampleBusiness(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return {
    id: "client-1",
    businessId: "biz-1",
    name: "Northshore Learning Center",
    industry: "Child care agency",
    gbpSecondaryCategories: ["Preschool"],
    location: {
      address: "1 Main St",
      city: "Mandeville",
      state: "LA",
      zip: "70471",
      lat: 0,
      lng: 0,
    },
    keywords: ["daycare", "preschool"],
    phone: "+15045550100",
    website: "https://northshore.example",
    ...overrides,
  };
}

describe("resolveFlyerDesignArchetype", () => {
  it("maps childcare categories to friendly-educational", () => {
    assert.equal(
      resolveFlyerDesignArchetype({
        primaryCategory: "Child care agency",
        industry: "Child care agency",
        categories: ["Preschool"],
      }),
      "friendly-educational"
    );
  });

  it("maps electricians to industrial-modern", () => {
    assert.equal(
      resolveFlyerDesignArchetype({
        primaryCategory: "Electrician",
        industry: "Electrician",
      }),
      "industrial-modern"
    );
  });

  it("falls back to local-trust", () => {
    assert.equal(
      resolveFlyerDesignArchetype({
        primaryCategory: "Local business",
        industry: "Local business",
      }),
      "local-trust"
    );
  });
});

describe("buildFlyerDesignBrief", () => {
  it("enriches the brief with archetype and GBP fields", () => {
    const brief = buildFlyerDesignBrief({
      guide: sampleGuide(),
      business: sampleBusiness(),
      publicUrl: "https://example.com/g/northshore-learning",
      template: "professional",
      format: "letter",
      enrichment: {
        primaryCategory: "Child care agency",
        description: "Premier early childhood education in Mandeville.",
        averageRating: 4.9,
        reviewCount: 127,
        photoUrls: ["https://example.com/photo.jpg"],
      },
    });

    assert.equal(brief.archetype, "friendly-educational");
    assert.equal(brief.primaryCategory, "Child care agency");
    assert.equal(brief.reviewCount, 127);
    assert.equal(brief.profileGuideActions[0], "Leave a Review");
    assert.ok(brief.photoUrls.length > 0);
  });
});

describe("buildFlyerBackgroundPromptTemplate", () => {
  it("includes archetype direction and never-do rules", () => {
    const brief = buildFlyerDesignBrief({
      guide: sampleGuide(),
      business: sampleBusiness(),
      publicUrl: "https://example.com/g/northshore-learning",
      template: "friendly",
      format: "letter",
      enrichment: {
        primaryCategory: "Child care agency",
        description: "Premier early childhood education.",
        averageRating: 4.9,
        reviewCount: 127,
      },
    });

    const prompt = buildFlyerBackgroundPromptTemplate(brief);

    assert.match(prompt, /Northshore Learning Center/i);
    assert.match(prompt, /Friendly Educational/i);
    assert.match(prompt, /Do NOT include any text/i);
    assert.match(prompt, /4\.9 stars/i);
    assert.match(prompt, /QR code \(composited separately\)/i);
    assert.match(prompt, /top-tier branding agency/i);
  });
});
