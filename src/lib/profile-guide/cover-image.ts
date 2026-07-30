import type { GbpMediaPreview } from "@/audit/types";

/** Best URL to use as a Profile Guide cover image. */
export function profileGuideCoverImageUrl(item: GbpMediaPreview): string {
  return item.googleUrl || item.thumbnailUrl;
}

export function isProfileGuideCoverImage(
  selectedUrl: string | null | undefined,
  item: GbpMediaPreview
): boolean {
  if (!selectedUrl) return false;
  return selectedUrl === item.googleUrl || selectedUrl === item.thumbnailUrl;
}
