import type { FullAuditPayload } from "@/audit/types";
import type { GbpMediaCategory } from "./gbp-media";
import {
  AT_WORK_PHOTO_GAP_TITLE,
  buildAtWorkPhotoHint,
  mediaCategoryLabel,
  RECOMMENDED_PHOTO_CATEGORIES,
  type GbpMediaCoverage,
} from "./gbp-media-coverage";

export interface CategoryBatchUploadJob {
  category: GbpMediaCategory;
  title: string;
  hint: string;
  priority: number;
  reason: string;
}

function cityFromAudit(audit: FullAuditPayload): string {
  return audit.gbp.identity.address.split(",").slice(-2, -1)[0]?.trim() ?? "your area";
}

/** Build prioritized photo upload jobs for each missing recommended category. */
export function buildCategoryBatchUploadJobs(
  audit: FullAuditPayload,
  coverage?: GbpMediaCoverage
): CategoryBatchUploadJob[] {
  const resolved = coverage ?? audit.gbp.content.mediaCoverage;
  if (!resolved) return [];

  const missing = new Set(resolved.missingCategories);
  const city = cityFromAudit(audit);
  const category = audit.gbp.identity.primaryCategory;
  const jobs: CategoryBatchUploadJob[] = [];

  const hints: Partial<Record<GbpMediaCategory, string>> = {
    EXTERIOR: `Upload a wide storefront or entrance shot in ${city}.`,
    INTERIOR: "Show your workspace, showroom, or customer area.",
    AT_WORK: buildAtWorkPhotoHint(category, city),
    TEAMS: `Introduce your team serving ${city} customers.`,
  };

  for (const rawCategory of RECOMMENDED_PHOTO_CATEGORIES) {
    const cat = rawCategory as GbpMediaCategory;
    if (!missing.has(rawCategory)) continue;

    jobs.push({
      category: cat,
      title:
        cat === "AT_WORK"
          ? AT_WORK_PHOTO_GAP_TITLE
          : `Upload ${mediaCategoryLabel(cat)} photo`,
      hint: hints[cat] ?? `Add a ${mediaCategoryLabel(cat).toLowerCase()} photo.`,
      priority:
        cat === "AT_WORK"
          ? -1
          : RECOMMENDED_PHOTO_CATEGORIES.indexOf(rawCategory),
      reason:
        cat === "AT_WORK"
          ? "Google recommends work photos on your completeness checklist."
          : `Missing ${mediaCategoryLabel(cat).toLowerCase()} category on your profile.`,
    });
  }

  return jobs.sort((a, b) => a.priority - b.priority).slice(0, 4);
}
