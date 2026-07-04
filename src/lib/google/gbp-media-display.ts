import type { GbpMediaPreview } from "@/audit/types";

const PREFERRED_HERO_CATEGORIES = new Set([
  "COVER",
  "EXTERIOR",
  "PROFILE",
  "INTERIOR",
  "AT_WORK",
]);

/** Prefer owner-uploaded branded photos for listing hero imagery. */
export function selectPreferredHeroPreview(
  previews: GbpMediaPreview[] | undefined
): GbpMediaPreview | undefined {
  if (!previews?.length) return undefined;

  const photos = previews.filter((item) => item.mediaFormat === "PHOTO" && item.thumbnailUrl);
  if (photos.length === 0) return previews[0];

  const ownerPhotos = photos.filter((item) => !item.isCustomerPhoto);
  const pool = ownerPhotos.length > 0 ? ownerPhotos : photos;

  const preferred = pool.find((item) => item.category && PREFERRED_HERO_CATEGORIES.has(item.category));
  return preferred ?? pool[0];
}

export function formatCustomerAttribution(name?: string): string {
  if (!name?.trim()) return "Customer";
  return name.trim();
}
