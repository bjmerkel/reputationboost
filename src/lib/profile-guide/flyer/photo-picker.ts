import type { GbpMediaPreview } from "@/audit/types";
import { profileGuideCoverImageUrl } from "../cover-image";
import type { FlyerDesignArchetype } from "./archetypes";

export interface FlyerGbpPhoto {
  url: string;
  thumbnailUrl: string;
  category: string | null;
  viewCount: number | null;
  isCustomerPhoto: boolean;
}

const ARCHETYPE_PHOTO_CATEGORIES: Partial<Record<FlyerDesignArchetype, string[]>> = {
  "editorial-food": ["FOOD", "INTERIOR", "AT_WORK", "EXTERIOR", "COVER", "PROFILE"],
  "clinical-luxury": ["INTERIOR", "TEAM", "COVER", "PROFILE", "EXTERIOR"],
  "friendly-educational": ["INTERIOR", "TEAM", "AT_WORK", "COVER", "EXTERIOR"],
  "luxury-boutique": ["INTERIOR", "COVER", "PROFILE", "AT_WORK", "EXTERIOR"],
  "organic-minimal": ["INTERIOR", "COVER", "TEAM", "EXTERIOR"],
  "athletic-energy": ["INTERIOR", "AT_WORK", "TEAM", "EXTERIOR", "COVER"],
  "executive": ["INTERIOR", "TEAM", "COVER", "EXTERIOR", "PROFILE"],
  "cozy-lifestyle": ["INTERIOR", "EXTERIOR", "AT_WORK", "COVER", "FOOD"],
  "modern-luxury": ["EXTERIOR", "COVER", "INTERIOR", "PROFILE"],
  "industrial-modern": ["AT_WORK", "EXTERIOR", "INTERIOR", "COVER", "TEAM"],
  "technical-professional": ["INTERIOR", "TEAM", "AT_WORK", "COVER", "EXTERIOR"],
  "local-trust": ["COVER", "EXTERIOR", "INTERIOR", "PROFILE", "AT_WORK"],
};

const DEFAULT_PHOTO_CATEGORIES = ["COVER", "EXTERIOR", "INTERIOR", "PROFILE", "AT_WORK"];

function photoScore(
  photo: FlyerGbpPhoto,
  preferredCategories: string[]
): number {
  let score = 0;
  const categoryIndex = photo.category
    ? preferredCategories.indexOf(photo.category)
    : -1;

  if (categoryIndex >= 0) {
    score += (preferredCategories.length - categoryIndex) * 10;
  }

  if (!photo.isCustomerPhoto) {
    score += 5;
  }

  if (photo.viewCount && photo.viewCount > 0) {
    score += Math.min(4, Math.log10(photo.viewCount + 1));
  }

  return score;
}

export function toFlyerGbpPhoto(item: GbpMediaPreview): FlyerGbpPhoto | null {
  const url = profileGuideCoverImageUrl(item);
  if (!url || item.mediaFormat !== "PHOTO") return null;

  return {
    url,
    thumbnailUrl: item.thumbnailUrl || url,
    category: item.category,
    viewCount: item.viewCount ?? null,
    isCustomerPhoto: Boolean(item.isCustomerPhoto),
  };
}

export function extractFlyerGbpPhotos(
  previews: GbpMediaPreview[] | undefined
): FlyerGbpPhoto[] {
  if (!previews?.length) return [];

  const seen = new Set<string>();
  const photos: FlyerGbpPhoto[] = [];

  for (const item of previews) {
    const photo = toFlyerGbpPhoto(item);
    if (!photo || seen.has(photo.url)) continue;
    seen.add(photo.url);
    photos.push(photo);
  }

  return photos.slice(0, 12);
}

export function selectFlyerCoverPhoto(input: {
  archetype: FlyerDesignArchetype;
  photos: FlyerGbpPhoto[];
  guideCoverUrl?: string | null;
  selectedCoverUrl?: string | null;
}): string | null {
  if (input.selectedCoverUrl?.trim()) {
    return input.selectedCoverUrl.trim();
  }

  if (input.guideCoverUrl?.trim()) {
    return input.guideCoverUrl.trim();
  }

  if (input.photos.length === 0) return null;

  const preferredCategories =
    ARCHETYPE_PHOTO_CATEGORIES[input.archetype] ?? DEFAULT_PHOTO_CATEGORIES;

  const ranked = [...input.photos].sort(
    (left, right) =>
      photoScore(right, preferredCategories) - photoScore(left, preferredCategories)
  );

  return ranked[0]?.url ?? null;
}
