import type { GbpMediaCategory } from "./gbp-media";
import { mediaCategoryLabel, type GbpMediaCoverage } from "./gbp-media-coverage";

export interface MediaCategoryStatus {
  category: string;
  label: string;
  count: number;
  recommended: boolean;
  filled: boolean;
}

export interface MediaHealthReport {
  overallScore: number;
  coverageScore: number;
  engagementScore: number;
  videoScore: number;
  recencyScore: number;
  categoryStatus: MediaCategoryStatus[];
  recommendations: string[];
  hasVideo: boolean;
  ownerPhotoCount: number;
  customerPhotoCount: number;
  totalViews: number;
  daysSinceLastUpload: number | null;
}

function recencyScore(days: number | null): number {
  if (days === null) return 40;
  if (days <= 30) return 100;
  if (days <= 90) return 70;
  return 40;
}

/** Summarize media health for dashboard display and plan prioritization. */
export function buildMediaHealthReport(
  coverage: GbpMediaCoverage,
  photosByType: Record<string, number> = {}
): MediaHealthReport {
  const categoryChecks: Array<{ category: GbpMediaCategory; filled: boolean }> = [
    { category: "COVER", filled: coverage.hasCover },
    { category: "LOGO", filled: coverage.hasLogo },
    { category: "EXTERIOR", filled: coverage.hasExterior },
    { category: "INTERIOR", filled: coverage.hasInterior },
    { category: "AT_WORK", filled: coverage.hasAtWork },
    { category: "TEAMS", filled: coverage.hasTeam },
  ];

  const categoryStatus: MediaCategoryStatus[] = categoryChecks.map(({ category, filled }) => ({
    category,
    label: mediaCategoryLabel(category),
    count: photosByType[category] ?? 0,
    recommended: ["EXTERIOR", "INTERIOR", "AT_WORK", "TEAMS"].includes(category),
    filled,
  }));

  const recommendations: string[] = [];

  for (const missing of coverage.missingCategories) {
    recommendations.push(
      `Upload ${missing.replace(/_/g, " ").toLowerCase()} photos to fill a category gap.`
    );
  }
  if (!coverage.hasVideo) {
    recommendations.push("Add a 30–60 second video showing your team or service in action.");
  }
  if (
    coverage.photoViewsAvailable &&
    coverage.engagementScore < 50 &&
    coverage.ownerPhotoCount >= 10
  ) {
    recommendations.push(
      "Replace low-view photos with fresh, categorized images to improve engagement."
    );
  }
  if (coverage.customerPhotoShare >= 55 && coverage.ownerPhotoCount < 15) {
    recommendations.push("Add more owner-uploaded photos so you control the first impression.");
  }
  if (coverage.daysSinceLastUpload !== null && coverage.daysSinceLastUpload > 90) {
    recommendations.push(`Last upload was ${coverage.daysSinceLastUpload} days ago — add fresh media.`);
  }

  const videoScore = coverage.hasVideo ? 100 : 0;
  const recency = recencyScore(coverage.daysSinceLastUpload);
  const overallScore = Math.round(
    coverage.coverageScore * 0.4 +
      coverage.engagementScore * 0.3 +
      videoScore * 0.15 +
      recency * 0.15
  );

  return {
    overallScore,
    coverageScore: coverage.coverageScore,
    engagementScore: coverage.engagementScore,
    videoScore,
    recencyScore: recency,
    categoryStatus,
    recommendations: recommendations.slice(0, 6),
    hasVideo: coverage.hasVideo,
    ownerPhotoCount: coverage.ownerPhotoCount,
    customerPhotoCount: coverage.customerPhotoCount,
    totalViews: coverage.totalViews,
    daysSinceLastUpload: coverage.daysSinceLastUpload,
  };
}
