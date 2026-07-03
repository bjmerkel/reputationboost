import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";

const GBP_V4 = "https://mybusiness.googleapis.com/v4";
const GBP_UPLOAD = "https://mybusiness.googleapis.com/upload/v1";

export type GbpMediaFormat = "PHOTO" | "VIDEO";

export type GbpMediaCategory =
  | "COVER"
  | "PROFILE"
  | "LOGO"
  | "EXTERIOR"
  | "INTERIOR"
  | "PRODUCT"
  | "AT_WORK"
  | "FOOD_AND_DRINK"
  | "MENU"
  | "COMMON_AREA"
  | "ROOMS"
  | "TEAMS"
  | "ADDITIONAL";

export interface GbpMediaItem {
  name: string;
  mediaFormat: GbpMediaFormat;
  category: GbpMediaCategory | null;
  googleUrl: string;
  thumbnailUrl: string;
  createTime: string;
  description: string;
  viewCount: string;
}

export interface GbpMediaSummary {
  photoCount: number;
  videoCount: number;
  photosByType: Record<string, number>;
  lastPhotoUpload: string | null;
  items: GbpMediaItem[];
}

interface MediaApiItem {
  name?: string;
  mediaFormat?: string;
  locationAssociation?: { category?: string };
  googleUrl?: string;
  thumbnailUrl?: string;
  createTime?: string;
  description?: string;
  insights?: { viewCount?: string };
}

function mediaParent(connection: GbpConnection): string {
  return `accounts/${connection.accountId}/locations/${connection.locationId}`;
}

function normalizeCategory(category?: string): GbpMediaCategory | null {
  if (!category || category === "CATEGORY_UNSPECIFIED") return null;
  return category as GbpMediaCategory;
}

function normalizeFormat(format?: string): GbpMediaFormat {
  return format === "VIDEO" ? "VIDEO" : "PHOTO";
}

/** Extract the first public http(s) URL from task draft text. */
export function extractPublicMediaUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)<>"']+/i);
  return match?.[0]?.replace(/[.,;]+$/, "") ?? null;
}

/** accounts.locations.media.list */
export async function listGbpMedia(connection: GbpConnection): Promise<GbpMediaItem[]> {
  const items: GbpMediaItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GBP_V4}/${mediaParent(connection)}/media`);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: authHeadersForConnection(connection),
    });

    const data = (await res.json()) as {
      mediaItems?: MediaApiItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message ?? `Media list failed (${res.status})`);
    }

    for (const item of data.mediaItems ?? []) {
      items.push({
        name: item.name ?? "",
        mediaFormat: normalizeFormat(item.mediaFormat),
        category: normalizeCategory(item.locationAssociation?.category),
        googleUrl: item.googleUrl ?? "",
        thumbnailUrl: item.thumbnailUrl ?? "",
        createTime: item.createTime ?? "",
        description: item.description ?? "",
        viewCount: item.insights?.viewCount ?? "0",
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && items.length < 500);

  return items;
}

export function summarizeGbpMedia(items: GbpMediaItem[]): GbpMediaSummary {
  const photos = items.filter((i) => i.mediaFormat === "PHOTO");
  const videos = items.filter((i) => i.mediaFormat === "VIDEO");
  const photosByType: Record<string, number> = {};

  for (const photo of photos) {
    const key = photo.category ?? "ADDITIONAL";
    photosByType[key] = (photosByType[key] ?? 0) + 1;
  }

  const sortedPhotos = [...photos].sort(
    (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
  );

  return {
    photoCount: photos.length,
    videoCount: videos.length,
    photosByType,
    lastPhotoUpload: sortedPhotos[0]?.createTime ?? null,
    items,
  };
}

export async function fetchGbpMediaSummary(
  connection: GbpConnection
): Promise<GbpMediaSummary> {
  const items = await listGbpMedia(connection);
  return summarizeGbpMedia(items);
}

/** accounts.locations.media.create via public sourceUrl */
export async function createGbpMediaFromUrl(
  connection: GbpConnection,
  options: {
    sourceUrl: string;
    mediaFormat: GbpMediaFormat;
    category: GbpMediaCategory;
    description?: string;
  }
): Promise<GbpMediaItem> {
  const sourceUrl = options.sourceUrl.trim();
  if (!sourceUrl.startsWith("http")) {
    throw new Error("A public image or video URL is required (must start with http).");
  }

  const url = `${GBP_V4}/${mediaParent(connection)}/media`;
  const body: Record<string, unknown> = {
    mediaFormat: options.mediaFormat,
    locationAssociation: { category: options.category },
    sourceUrl,
  };
  if (options.description?.trim()) {
    body.description = options.description.trim().slice(0, 500);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as MediaApiItem & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Media upload failed (${res.status})`);
  }

  return {
    name: data.name ?? "",
    mediaFormat: normalizeFormat(data.mediaFormat ?? options.mediaFormat),
    category: normalizeCategory(data.locationAssociation?.category ?? options.category),
    googleUrl: data.googleUrl ?? sourceUrl,
    thumbnailUrl: data.thumbnailUrl ?? "",
    createTime: data.createTime ?? new Date().toISOString(),
    description: data.description ?? options.description ?? "",
    viewCount: data.insights?.viewCount ?? "0",
  };
}

/** accounts.locations.media.startUpload */
export async function startGbpMediaUpload(
  connection: GbpConnection
): Promise<string> {
  const url = `${GBP_V4}/${mediaParent(connection)}/media:startUpload`;

  const res = await fetch(url, {
    method: "POST",
    headers: authHeadersForConnection(connection),
  });

  const data = (await res.json()) as {
    resourceName?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.resourceName) {
    throw new Error(data.error?.message ?? `Media upload start failed (${res.status})`);
  }

  return data.resourceName;
}

/** Upload raw bytes to Google's media upload endpoint. */
export async function uploadGbpMediaBytes(
  connection: GbpConnection,
  resourceName: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  const url = `${GBP_UPLOAD}/media/${resourceName}?uploadType=media`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": contentType,
    },
    body: bytes,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Media byte upload failed (${res.status})`);
  }
}

/** Create media item from an uploaded dataRef. */
export async function createGbpMediaFromUpload(
  connection: GbpConnection,
  options: {
    resourceName: string;
    mediaFormat: GbpMediaFormat;
    category: GbpMediaCategory;
    description?: string;
  }
): Promise<GbpMediaItem> {
  const url = `${GBP_V4}/${mediaParent(connection)}/media`;
  const body: Record<string, unknown> = {
    mediaFormat: options.mediaFormat,
    locationAssociation: { category: options.category },
    dataRef: { resourceName: options.resourceName },
  };
  if (options.description?.trim()) {
    body.description = options.description.trim().slice(0, 500);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as MediaApiItem & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Media create failed (${res.status})`);
  }

  return {
    name: data.name ?? "",
    mediaFormat: normalizeFormat(data.mediaFormat ?? options.mediaFormat),
    category: normalizeCategory(data.locationAssociation?.category ?? options.category),
    googleUrl: data.googleUrl ?? "",
    thumbnailUrl: data.thumbnailUrl ?? "",
    createTime: data.createTime ?? new Date().toISOString(),
    description: data.description ?? options.description ?? "",
    viewCount: data.insights?.viewCount ?? "0",
  };
}

/** Convenience: startUpload → upload bytes → create media item. */
export async function uploadGbpMediaFile(
  connection: GbpConnection,
  file: { bytes: ArrayBuffer; contentType: string },
  options: {
    mediaFormat: GbpMediaFormat;
    category: GbpMediaCategory;
    description?: string;
  }
): Promise<GbpMediaItem> {
  const resourceName = await startGbpMediaUpload(connection);
  await uploadGbpMediaBytes(connection, resourceName, file.bytes, file.contentType);
  return createGbpMediaFromUpload(connection, {
    resourceName,
    ...options,
  });
}

/** accounts.locations.media.delete */
export async function deleteGbpMedia(
  connection: GbpConnection,
  mediaName: string
): Promise<void> {
  const resource = mediaName.includes("/")
    ? mediaName
    : `${mediaParent(connection)}/media/${mediaName}`;

  const res = await fetch(`${GBP_V4}/${resource}`, {
    method: "DELETE",
    headers: authHeadersForConnection(connection),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Media delete failed (${res.status})`);
  }
}
