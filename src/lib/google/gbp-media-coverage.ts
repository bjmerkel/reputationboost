import type { GbpMediaCategory, GbpMediaItem } from "./gbp-media";
import { parseMediaViewCount } from "./gbp-media";

export interface GbpMediaCoverage {
  totalCount: number;
  ownerPhotoCount: number;
  customerPhotoCount: number;
  hasCover: boolean;
  hasLogo: boolean;
  hasExterior: boolean;
  hasInterior: boolean;
  hasTeam: boolean;
  hasAtWork: boolean;
  hasVideo: boolean;
  categoryCount: number;
  missingCategories: string[];
  coverageScore: number;
  totalViews: number;
  ownerTotalViews: number;
  ownerAvgViews: number;
  ownerZeroViewCount: number;
  customerPhotoShare: number;
  engagementScore: number;
  daysSinceLastUpload: number | null;
  /** False when Google does not return per-photo MediaInsights (deprecated API field). */
  photoViewsAvailable: boolean;
}

/** Categories that strengthen trust for most local service businesses. */
export const RECOMMENDED_PHOTO_CATEGORIES: GbpMediaCategory[] = [
  "EXTERIOR",
  "INTERIOR",
  "AT_WORK",
  "TEAMS",
];

const CATEGORY_LABELS: Record<GbpMediaCategory, string> = {
  COVER: "Cover photo",
  PROFILE: "Profile photo",
  LOGO: "Logo",
  EXTERIOR: "Exterior",
  INTERIOR: "Interior",
  PRODUCT: "Product",
  AT_WORK: "At work",
  FOOD_AND_DRINK: "Food & drink",
  MENU: "Menu",
  COMMON_AREA: "Common area",
  ROOMS: "Rooms",
  TEAMS: "Team",
  ADDITIONAL: "Additional",
};

export function mediaCategoryLabel(category: GbpMediaCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

function isCustomerMedia(item: GbpMediaItem): boolean {
  return Boolean(item.attribution?.profileName);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

/** Analyze category coverage and engagement from listed media items. */
export function analyzeGbpMediaCoverage(
  items: GbpMediaItem[],
  options?: { totalCount?: number }
): GbpMediaCoverage {
  const photos = items.filter((item) => item.mediaFormat === "PHOTO");
  const ownerPhotos = photos.filter((item) => !isCustomerMedia(item));
  const customerPhotos = photos.filter((item) => isCustomerMedia(item));
  const videos = items.filter((item) => item.mediaFormat === "VIDEO");

  const photosByCategory = new Set<GbpMediaCategory>();
  for (const photo of photos) {
    if (photo.category) photosByCategory.add(photo.category);
  }

  const hasCategory = (category: GbpMediaCategory) => photosByCategory.has(category);
  const missingCategories = RECOMMENDED_PHOTO_CATEGORIES.filter((category) => !hasCategory(category));

  const categoryChecks = RECOMMENDED_PHOTO_CATEGORIES.map((category) => hasCategory(category));
  const categoryFilled = categoryChecks.filter(Boolean).length;
  const categoryScore = (categoryFilled / RECOMMENDED_PHOTO_CATEGORIES.length) * 100;

  const countScore = Math.min(100, (photos.length / 60) * 100);
  const videoScore = videos.length > 0 ? 100 : 0;
  const recencyDays = daysSince(
    [...photos].sort(
      (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    )[0]?.createTime ?? null
  );
  const recencyScore =
    recencyDays === null ? 40 : recencyDays <= 30 ? 100 : recencyDays <= 90 ? 70 : 40;

  const coverageScore = Math.round(
    countScore * 0.45 + categoryScore * 0.35 + videoScore * 0.1 + recencyScore * 0.1
  );

  const totalViews = items.reduce(
    (sum, item) => sum + (parseMediaViewCount(item.viewCount) ?? 0),
    0
  );
  const ownerPhotosWithViews = ownerPhotos.filter(
    (item) => parseMediaViewCount(item.viewCount) !== null
  );
  const photoViewsAvailable = ownerPhotosWithViews.length > 0;
  const ownerTotalViews = ownerPhotosWithViews.reduce(
    (sum, item) => sum + (parseMediaViewCount(item.viewCount) ?? 0),
    0
  );
  const ownerZeroViewCount = ownerPhotosWithViews.filter(
    (item) => parseMediaViewCount(item.viewCount) === 0
  ).length;
  const ownerAvgViews =
    ownerPhotosWithViews.length > 0
      ? Math.round((ownerTotalViews / ownerPhotosWithViews.length) * 10) / 10
      : 0;
  const customerPhotoShare =
    photos.length > 0 ? Math.round((customerPhotos.length / photos.length) * 100) : 0;

  const avgViewScore = photoViewsAvailable
    ? Math.min(100, (ownerAvgViews / 15) * 100)
    : 0;
  const zeroViewRatio =
    ownerPhotosWithViews.length > 0 ? ownerZeroViewCount / ownerPhotosWithViews.length : 0;
  const zeroViewScore = photoViewsAvailable ? Math.max(0, 100 - zeroViewRatio * 100) : 0;
  const ownerShareScore =
    customerPhotoShare <= 40 ? 100 : customerPhotoShare <= 60 ? 70 : 40;
  const engagementScore = photoViewsAvailable
    ? Math.round(avgViewScore * 0.6 + zeroViewScore * 0.25 + ownerShareScore * 0.15)
    : ownerShareScore;

  return {
    totalCount: options?.totalCount ?? items.length,
    ownerPhotoCount: ownerPhotos.length,
    customerPhotoCount: customerPhotos.length,
    hasCover: hasCategory("COVER"),
    hasLogo: hasCategory("LOGO"),
    hasExterior: hasCategory("EXTERIOR"),
    hasInterior: hasCategory("INTERIOR"),
    hasTeam: hasCategory("TEAMS"),
    hasAtWork: hasCategory("AT_WORK"),
    hasVideo: videos.length > 0,
    categoryCount: photosByCategory.size,
    missingCategories: missingCategories.map(String),
    coverageScore,
    totalViews,
    ownerTotalViews,
    ownerAvgViews,
    ownerZeroViewCount,
    customerPhotoShare,
    engagementScore,
    daysSinceLastUpload: recencyDays,
    photoViewsAvailable,
  };
}

/** Minimum video upload size (100 KB). */
export function validateMediaVideoUpload(bytes: ArrayBuffer): {
  valid: boolean;
  reason?: string;
} {
  if (bytes.byteLength < 102_400) {
    return {
      valid: false,
      reason: "Video must be at least 100 KB. Choose a higher-quality clip.",
    };
  }
  return { valid: true };
}

/** Minimum upload requirements from Google Business Profile media guidelines. */
export function validateMediaUploadBytes(bytes: ArrayBuffer): {
  valid: boolean;
  reason?: string;
} {
  if (bytes.byteLength < 10_240) {
    return {
      valid: false,
      reason: "Image must be at least 10 KB. Choose a higher-resolution photo.",
    };
  }
  return { valid: true };
}

export async function validateMediaImageDimensions(
  bytes: ArrayBuffer,
  contentType: string
): Promise<{ valid: boolean; reason?: string; width?: number; height?: number }> {
  if (!contentType.startsWith("image/")) {
    return { valid: true };
  }

  try {
    const size = await readImageDimensions(bytes, contentType);
    if (!size) return { valid: true };

    const shortEdge = Math.min(size.width, size.height);
    if (shortEdge < 250) {
      return {
        valid: false,
        reason: `Image short edge is ${shortEdge}px. Google requires at least 250px.`,
        width: size.width,
        height: size.height,
      };
    }

    return { valid: true, width: size.width, height: size.height };
  } catch {
    return { valid: true };
  }
}

async function readImageDimensions(
  bytes: ArrayBuffer,
  contentType: string
): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === "function") {
    const blob = new Blob([bytes], { type: contentType });
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }

  return parsePngOrJpegDimensions(bytes);
}

function parsePngOrJpegDimensions(bytes: ArrayBuffer): { width: number; height: number } | null {
  const view = new DataView(bytes);
  if (view.byteLength >= 24 && view.getUint32(0) === 0x89504e47) {
    return {
      width: view.getUint32(16),
      height: view.getUint32(20),
    };
  }

  if (view.byteLength >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset < view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const length = view.getUint16(offset + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  return null;
}
