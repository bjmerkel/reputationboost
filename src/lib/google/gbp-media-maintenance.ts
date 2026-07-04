import type { GbpMediaCategory, GbpMediaItem } from "./gbp-media";
import {
  analyzeGbpMediaCoverage,
  mediaCategoryLabel,
  type GbpMediaCoverage,
} from "./gbp-media-coverage";

export interface MediaMaintenanceAction {
  type: "recategorize" | "delete";
  mediaName: string;
  thumbnailUrl: string;
  currentCategory: GbpMediaCategory | null;
  targetCategory?: GbpMediaCategory;
  reason: string;
  viewCount: number;
}

function isCustomerMedia(item: GbpMediaItem): boolean {
  return Boolean(item.attribution?.profileName);
}

function parseViewCount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysSince(iso: string): number | null {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Suggest recategorize/delete actions to improve media coverage. */
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

  for (const missingCategory of resolvedCoverage.missingCategories) {
    const candidate = additionalPhotos.find((item) => !usedNames.has(item.name));
    if (!candidate) continue;

    usedNames.add(candidate.name);
    actions.push({
      type: "recategorize",
      mediaName: candidate.name,
      thumbnailUrl: candidate.thumbnailUrl || candidate.googleUrl,
      currentCategory: candidate.category,
      targetCategory: missingCategory as GbpMediaCategory,
      reason: `Move this photo from Additional to ${mediaCategoryLabel(
        missingCategory as GbpMediaCategory
      )} to fill a category gap.`,
      viewCount: parseViewCount(candidate.viewCount),
    });
  }

  if (
    additionalPhotos.length >= 8 &&
    resolvedCoverage.missingCategories.length > 0 &&
    actions.length === 0
  ) {
    const lowPerformer = [...additionalPhotos]
      .filter((item) => !usedNames.has(item.name))
      .sort((a, b) => parseViewCount(a.viewCount) - parseViewCount(b.viewCount))[0];

    if (lowPerformer) {
      actions.push({
        type: "delete",
        mediaName: lowPerformer.name,
        thumbnailUrl: lowPerformer.thumbnailUrl || lowPerformer.googleUrl,
        currentCategory: lowPerformer.category,
        reason:
          "Remove a low-performing uncategorized photo, then upload a categorized replacement.",
        viewCount: parseViewCount(lowPerformer.viewCount),
      });
    }
  }

  const staleCandidate = [...ownerPhotos]
    .filter((item) => item.category === "ADDITIONAL" && !usedNames.has(item.name))
    .filter((item) => {
      const age = daysSince(item.createTime);
      return age !== null && age > 180 && parseViewCount(item.viewCount) === 0;
    })
    .sort((a, b) => parseViewCount(a.viewCount) - parseViewCount(b.viewCount))[0];

  if (staleCandidate && actions.length < 4) {
    actions.push({
      type: "delete",
      mediaName: staleCandidate.name,
      thumbnailUrl: staleCandidate.thumbnailUrl || staleCandidate.googleUrl,
      currentCategory: staleCandidate.category,
      reason:
        "This uncategorized photo is over 6 months old with zero views. Replace it with fresh media.",
      viewCount: 0,
    });
  }

  return actions.slice(0, 4);
}
