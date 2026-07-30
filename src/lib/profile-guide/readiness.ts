import type { ProfileGuideLinkRecord, ProfileGuideWithLinks } from "./types";

export interface ProfileGuideReadiness {
  exists: boolean;
  published: boolean;
  reviewLinkEnabled: boolean;
  views30d: number;
  attributedReviews30d: number;
}

export const EMPTY_PROFILE_GUIDE_READINESS: ProfileGuideReadiness = {
  exists: false,
  published: false,
  reviewLinkEnabled: false,
  views30d: 0,
  attributedReviews30d: 0,
};

export function buildProfileGuideReadiness(input: {
  guide: ProfileGuideWithLinks | null;
  views30d?: number;
  attributedReviews30d?: number;
}): ProfileGuideReadiness {
  if (!input.guide) {
    return { ...EMPTY_PROFILE_GUIDE_READINESS };
  }

  const reviewLinkEnabled = input.guide.links.some(
    (link) => link.link_type === "review" && link.enabled
  );

  return {
    exists: true,
    published: input.guide.guide.published,
    reviewLinkEnabled,
    views30d: input.views30d ?? 0,
    attributedReviews30d: input.attributedReviews30d ?? 0,
  };
}

export function isProfileGuideReviewReady(readiness: ProfileGuideReadiness): boolean {
  return readiness.published && readiness.reviewLinkEnabled;
}

export function profileGuideEditorHref(
  businessId?: string | null,
  options?: { from?: "plan" | "home"; focus?: "publish" }
): string {
  const params = new URLSearchParams();
  if (businessId) params.set("businessId", businessId);
  params.set("tab", "profile-guide");
  if (options?.from) params.set("from", options.from);
  if (options?.focus) params.set("focus", options.focus);
  return `/platform/customers?${params.toString()}`;
}

export function reviewLinkEnabled(links: ProfileGuideLinkRecord[]): boolean {
  return links.some((link) => link.link_type === "review" && link.enabled);
}
