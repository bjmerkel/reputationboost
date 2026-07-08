import type { GbpMediaCategory, GbpMediaItem } from "./gbp-media";
import { formatMediaViewCountLabel, parseMediaViewCount } from "./gbp-media";
import {
  analyzeGbpMediaCoverage,
  type GbpMediaCoverage,
} from "./gbp-media-coverage";

export interface MediaMaintenanceAction {
  type: "delete";
  mediaName: string;
  thumbnailUrl: string;
  currentCategory: GbpMediaCategory | null;
  reason: string;
  viewCount: number | null;
}

function isCustomerMedia(item: GbpMediaItem): boolean {
  return Boolean(item.attribution?.profileName);
}

function compareViewCounts(a: GbpMediaItem, b: GbpMediaItem): number {
  const av = parseMediaViewCount(a.viewCount);
  const bv = parseMediaViewCount(b.viewCount);
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return av - bv;
}

function daysSince(iso: string): number | null {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Suggest delete actions to improve media coverage.
 * Google does not reliably support changing a photo's category after upload —
 * missing categories should be filled with new uploads instead.
 */
export function buildMediaMaintenanceActions(
  items: GbpMediaItem[],
  coverage?: GbpMediaCoverage
): MediaMaintenanceAction[] {
  const resolvedCoverage = coverage ?? analyzeGbpMediaCoverage(items);
  const actions: MediaMaintenanceAction[] = [];
  const usedNames = new Set<string>();

  const ownerPhotos = items.filter(
    (item) => item.mediaFormat === "PHOTO" && !isCustomerMedia(item)
  );
  const additionalPhotos = ownerPhotos.filter((item) => item.category === "ADDITIONAL");

  if (!resolvedCoverage.photoViewsAvailable) {
    return actions.slice(0, 4);
  }

  if (
    additionalPhotos.length >= 8 &&
    resolvedCoverage.missingCategories.length > 0 &&
    actions.length === 0
  ) {
    const lowPerformer = [...additionalPhotos]
      .filter((item) => !usedNames.has(item.name))
      .sort(compareViewCounts)[0];

    if (lowPerformer) {
      actions.push({
        type: "delete",
        mediaName: lowPerformer.name,
        thumbnailUrl: lowPerformer.thumbnailUrl || lowPerformer.googleUrl,
        currentCategory: lowPerformer.category,
        reason:
          "Remove a low-performing uncategorized photo, then upload a categorized replacement.",
        viewCount: parseMediaViewCount(lowPerformer.viewCount),
      });
    }
  }

  const staleCandidate = [...ownerPhotos]
    .filter((item) => item.category === "ADDITIONAL" && !usedNames.has(item.name))
    .filter((item) => {
      const age = daysSince(item.createTime);
      const views = parseMediaViewCount(item.viewCount);
      return age !== null && age > 180 && views === 0;
    })
    .sort(compareViewCounts)[0];

  if (staleCandidate && actions.length < 4) {
    actions.push({
      type: "delete",
      mediaName: staleCandidate.name,
      thumbnailUrl: staleCandidate.thumbnailUrl || staleCandidate.googleUrl,
      currentCategory: staleCandidate.category,
      reason:
        "This uncategorized photo is over 6 months old with zero views. Replace it with fresh media.",
      viewCount: parseMediaViewCount(staleCandidate.viewCount),
    });
  }

  return actions.slice(0, 4);
}

export { formatMediaViewCountLabel };
