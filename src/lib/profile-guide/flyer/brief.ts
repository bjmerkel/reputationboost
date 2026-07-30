import type { ClientConfig } from "@/audit/types";
import type { ProfileGuideFlyerTemplate } from "../theme";
import type { ProfileGuideWithLinks } from "../types";

export interface FlyerBrief {
  businessName: string;
  industry: string;
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
}

export function buildFlyerBrief(
  guide: ProfileGuideWithLinks,
  business: ClientConfig,
  publicUrl: string,
  template: ProfileGuideFlyerTemplate
): FlyerBrief {
  return {
    businessName: guide.guide.display_name,
    industry: business.industry?.trim() || "local business",
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
  };
}
