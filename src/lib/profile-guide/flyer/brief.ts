import type { ClientConfig } from "@/audit/types";
import type { ProfileGuideFlyerFormat } from "./formats";
import type { ProfileGuideFlyerTemplate } from "../theme";
import type { ProfileGuideWithLinks } from "../types";
import type { FlyerCopy } from "./copy";

export interface FlyerBrief {
  businessName: string;
  industry: string;
  categories: string[];
  keywords: string[];
  city: string;
  state: string;
  phone?: string | null;
  website?: string | null;
  tagline?: string | null;
  primaryColor: string;
  backgroundColor: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  publicUrl: string;
  template: ProfileGuideFlyerTemplate;
  format: ProfileGuideFlyerFormat;
  copy?: FlyerCopy;
}

export function buildFlyerBrief(
  guide: ProfileGuideWithLinks,
  business: ClientConfig,
  publicUrl: string,
  template: ProfileGuideFlyerTemplate,
  format: ProfileGuideFlyerFormat
): FlyerBrief {
  const categories = [
    business.industry?.trim(),
    ...(business.gbpSecondaryCategories ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));

  return {
    businessName: guide.guide.display_name,
    industry: business.industry?.trim() || "local business",
    categories: [...new Set(categories)],
    keywords: (business.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean).slice(0, 6),
    city: business.location.city?.trim() || "your area",
    state: business.location.state?.trim() || "",
    phone: business.phone,
    website: business.website,
    tagline: guide.guide.tagline,
    primaryColor: guide.guide.primary_color,
    backgroundColor: guide.guide.background_color,
    logoUrl: guide.guide.logo_url,
    coverImageUrl: guide.guide.background_image_url,
    publicUrl,
    template,
    format,
  };
}
