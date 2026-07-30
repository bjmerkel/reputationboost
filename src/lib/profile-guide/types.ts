import type {
  ProfileGuideButtonStyle,
  ProfileGuideFontPreset,
} from "./theme";

export const PROFILE_GUIDE_LINK_TYPES = [
  "review",
  "directions",
  "website",
  "book",
  "call",
  "text",
  "custom",
] as const;

export type ProfileGuideLinkType = (typeof PROFILE_GUIDE_LINK_TYPES)[number];

export type ProfileGuideEventType = "view" | "click";

export type ProfileGuideAnalyticsPeriod = 7 | 30 | 90;

export interface ProfileGuideRecord {
  id: string;
  business_id: string;
  user_id: string;
  slug: string;
  display_name: string;
  published: boolean;
  published_at: string | null;
  primary_color: string;
  background_color: string;
  button_style: ProfileGuideButtonStyle;
  font_preset: ProfileGuideFontPreset;
  logo_url: string | null;
  background_image_url: string | null;
  tagline: string | null;
  text_message: string | null;
  gbp_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileGuideLinkRecord {
  id: string;
  guide_id: string;
  link_type: ProfileGuideLinkType;
  label: string;
  url: string;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileGuideLinkInput {
  id?: string;
  linkType: ProfileGuideLinkType;
  label: string;
  url: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ProfileGuideWithLinks {
  guide: ProfileGuideRecord;
  links: ProfileGuideLinkRecord[];
}

export interface ProfileGuidePublicView {
  slug: string;
  displayName: string;
  primaryColor: string;
  backgroundColor: string;
  buttonStyle: ProfileGuideButtonStyle;
  fontPreset: ProfileGuideFontPreset;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
  tagline: string | null;
  links: Array<{
    id: string;
    linkType: ProfileGuideLinkType;
    label: string;
    url: string;
  }>;
}

export interface ProfileGuideSourceStats {
  source: string;
  views: number;
  clicks: number;
}

export interface ProfileGuideAnalyticsSummary {
  periodDays: ProfileGuideAnalyticsPeriod;
  totalViews: number;
  totalClicks: number;
  topLink: { id: string; label: string; clicks: number } | null;
  linkClicks: Array<{ id: string; label: string; linkType: ProfileGuideLinkType; clicks: number }>;
  sourceBreakdown: ProfileGuideSourceStats[];
  viewsByDay: Array<{ date: string; views: number }>;
  narrative: string;
  attributedReviews: number;
}

export interface ProfileGuideUpdateInput {
  published?: boolean;
  primaryColor?: string;
  backgroundColor?: string;
  buttonStyle?: ProfileGuideButtonStyle;
  fontPreset?: ProfileGuideFontPreset;
  logoUrl?: string | null;
  backgroundImageUrl?: string | null;
  tagline?: string | null;
  textMessage?: string | null;
  displayName?: string;
  links?: ProfileGuideLinkInput[];
}
