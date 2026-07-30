import type { ClientConfig } from "@/audit/types";
import type { ProfileGuideWithLinks } from "../types";
import type { FlyerGbpEnrichment } from "./design-brief";

export interface GoldenFlyerBusiness {
  id: string;
  guide: ProfileGuideWithLinks;
  client: ClientConfig;
  publicUrl: string;
  enrichment: FlyerGbpEnrichment;
  expectedArchetype: string;
}

function baseGuide(overrides: Partial<ProfileGuideWithLinks["guide"]> & { display_name: string }): ProfileGuideWithLinks {
  return {
    guide: {
      id: `guide-${overrides.display_name.toLowerCase().replace(/\s+/g, "-")}`,
      business_id: "biz-golden",
      user_id: "user-golden",
      slug: overrides.display_name.toLowerCase().replace(/\s+/g, "-"),
      published: true,
      published_at: null,
      primary_color: overrides.primary_color ?? "#1a73e8",
      background_color: "#f8f9fa",
      button_style: "rounded",
      font_preset: "professional",
      logo_url: null,
      background_image_url: null,
      tagline: overrides.tagline ?? null,
      text_message: null,
      gbp_synced_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    },
    links: [
      {
        id: "link-review",
        guide_id: "guide-golden",
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

function baseClient(overrides: Partial<ClientConfig> & { name: string; industry: string }): ClientConfig {
  const { name, industry, ...rest } = overrides;
  return {
    id: "client-golden",
    businessId: "biz-golden",
    name,
    industry,
    gbpSecondaryCategories: [],
    location: {
      address: "1 Main St",
      city: "Mandeville",
      state: "LA",
      zip: "70471",
      lat: 0,
      lng: 0,
    },
    keywords: [],
    phone: "+15045550100",
    website: "https://example.com",
    ...rest,
  };
}

export const GOLDEN_FLYER_BUSINESSES: Record<string, GoldenFlyerBusiness> = {
  childcare: {
    id: "childcare",
    guide: baseGuide({
      display_name: "Northshore Learning Center",
      tagline: "Learn, Play, and Grow",
    }),
    client: baseClient({
      name: "Northshore Learning Center",
      industry: "Child care agency",
      gbpSecondaryCategories: ["Preschool"],
      keywords: ["daycare", "preschool"],
      location: { city: "Mandeville", state: "LA", address: "1 Main St", zip: "70471", lat: 0, lng: 0 },
    }),
    publicUrl: "https://example.com/g/northshore-learning",
    enrichment: {
      primaryCategory: "Child care agency",
      description: "Premier early childhood education in Mandeville.",
      averageRating: 4.9,
      reviewCount: 127,
    },
    expectedArchetype: "friendly-educational",
  },
  electrician: {
    id: "electrician",
    guide: baseGuide({
      display_name: "Bayou Electric",
      primary_color: "#0f2d52",
    }),
    client: baseClient({
      name: "Bayou Electric",
      industry: "Electrician",
      keywords: ["electrical repair", "panel upgrade"],
      location: { city: "Metairie", state: "LA", address: "22 Power Ln", zip: "70001", lat: 0, lng: 0 },
    }),
    publicUrl: "https://example.com/g/bayou-electric",
    enrichment: {
      primaryCategory: "Electrician",
      averageRating: 4.8,
      reviewCount: 84,
    },
    expectedArchetype: "industrial-modern",
  },
  restaurant: {
    id: "restaurant",
    guide: baseGuide({
      display_name: "Crescent City Kitchen",
      primary_color: "#8b4513",
      tagline: "Fresh Gulf Coast flavors",
    }),
    client: baseClient({
      name: "Crescent City Kitchen",
      industry: "Restaurant",
      gbpSecondaryCategories: ["Seafood restaurant"],
      keywords: ["brunch", "gumbo"],
      location: { city: "New Orleans", state: "LA", address: "88 Bourbon St", zip: "70130", lat: 0, lng: 0 },
    }),
    publicUrl: "https://example.com/g/crescent-city-kitchen",
    enrichment: {
      primaryCategory: "Restaurant",
      description: "Neighborhood seafood and brunch spot.",
      averageRating: 4.7,
      reviewCount: 312,
    },
    expectedArchetype: "editorial-food",
  },
};
