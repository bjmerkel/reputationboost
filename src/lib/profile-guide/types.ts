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
  logo_url: string | null;
  tagline: string | null;
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
  logoUrl: string | null;
  tagline: string | null;
  links: Array<{
    id: string;
    linkType: ProfileGuideLinkType;
    label: string;
    url: string;
  }>;
}

export interface ProfileGuideAnalyticsSummary {
  periodDays: ProfileGuideAnalyticsPeriod;
  totalViews: number;
  totalClicks: number;
  topLink: { id: string; label: string; clicks: number } | null;
  linkClicks: Array<{ id: string; label: string; linkType: ProfileGuideLinkType; clicks: number }>;
  viewsByDay: Array<{ date: string; views: number }>;
  narrative: string;
}

export interface ProfileGuideUpdateInput {
  published?: boolean;
  primaryColor?: string;
  logoUrl?: string | null;
  tagline?: string | null;
  displayName?: string;
  links?: ProfileGuideLinkInput[];
}
