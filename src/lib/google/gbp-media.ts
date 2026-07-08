import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import {
  validateMediaImageDimensions,
  validateMediaUploadBytes,
  validateMediaVideoUpload,
} from "./gbp-media-coverage";

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

export interface GbpMediaAttribution {
  profileName?: string;
  profilePhotoUrl?: string;
  profileUrl?: string;
  takedownUrl?: string;
}

export interface GbpMediaDimensions {
  widthPixels: number;
  heightPixels: number;
}

export interface GbpMediaItem {
  name: string;
  mediaFormat: GbpMediaFormat;
  category: GbpMediaCategory | null;
  googleUrl: string;
  thumbnailUrl: string;
  createTime: string;
  description: string;
  viewCount: string;
  dimensions?: GbpMediaDimensions;
  attribution?: GbpMediaAttribution;
}

export interface GbpMediaSummary {
  photoCount: number;
  videoCount: number;
  photosByType: Record<string, number>;
  lastPhotoUpload: string | null;
  totalMediaItemCount: number;
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
  dimensions?: { widthPixels?: number; heightPixels?: number };
  attribution?: {
    profileName?: string;
    profilePhotoUrl?: string;
    profileUrl?: string;
    takedownUrl?: string;
  };
}

function mapMediaItem(item: MediaApiItem): GbpMediaItem {
  const googleUrl = item.googleUrl ?? "";
  const thumbnailUrl = item.thumbnailUrl || googleUrl;
  const dimensions =
    item.dimensions?.widthPixels && item.dimensions?.heightPixels
      ? {
          widthPixels: item.dimensions.widthPixels,
          heightPixels: item.dimensions.heightPixels,
        }
      : undefined;

  return {
    name: item.name ?? "",
    mediaFormat: normalizeFormat(item.mediaFormat),
    category: normalizeCategory(item.locationAssociation?.category),
    googleUrl,
    thumbnailUrl,
    createTime: item.createTime ?? "",
    description: item.description ?? "",
    viewCount: item.insights?.viewCount ?? "0",
    dimensions,
    attribution: item.attribution?.profileName
      ? {
          profileName: item.attribution.profileName,
          profilePhotoUrl: item.attribution.profilePhotoUrl,
          profileUrl: item.attribution.profileUrl,
          takedownUrl: item.attribution.takedownUrl,
        }
      : undefined,
  };
}

function normalizeAccountId(accountId: string): string {
  return accountId.replace(/^accounts\//, "");
}

function normalizeLocationId(locationId: string): string {
  return locationId.replace(/^locations\//, "");
}

function mediaParent(connection: GbpConnection): string {
  return `accounts/${normalizeAccountId(connection.accountId)}/locations/${normalizeLocationId(connection.locationId)}`;
}

/** Decode a base64 data URL into raw bytes for GBP byte upload. */
export function dataUrlToBytes(dataUrl: string): { bytes: ArrayBuffer; contentType: string } {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/s);
  if (!match) throw new Error("Invalid image preview data.");
  const binary = Buffer.from(match[2], "base64");
  return {
    bytes: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength),
    contentType: match[1],
  };
}

function mediaUploadUrl(resourceName: string): string {
  const encoded = resourceName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(`${GBP_UPLOAD}/media/${encoded}`);
  url.searchParams.set("uploadType", "media");
  url.searchParams.set("upload_type", "media");
  return url.toString();
}

export function buildGbpMediaUploadUrl(resourceName: string): string {
  return mediaUploadUrl(resourceName);
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
export async function listGbpMedia(connection: GbpConnection): Promise<{
  items: GbpMediaItem[];
  totalMediaItemCount: number;
}> {
  const items: GbpMediaItem[] = [];
  let pageToken: string | undefined;
  let totalMediaItemCount = 0;

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
      totalMediaItemCount?: number;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message ?? `Media list failed (${res.status})`);
    }

    if (typeof data.totalMediaItemCount === "number") {
      totalMediaItemCount = data.totalMediaItemCount;
    }

    for (const item of data.mediaItems ?? []) {
      items.push(mapMediaItem(item));
    }

    pageToken = data.nextPageToken;
  } while (pageToken && items.length < 500);

  return {
    items,
    totalMediaItemCount: totalMediaItemCount || items.length,
  };
}

/** accounts.locations.media.get */
export async function getGbpMedia(
  connection: GbpConnection,
  mediaName: string
): Promise<GbpMediaItem> {
  const resource = mediaName.includes("/")
    ? mediaName
    : `${mediaParent(connection)}/media/${mediaName}`;

  const res = await fetch(`${GBP_V4}/${resource}`, {
    headers: authHeadersForConnection(connection),
  });

  const data = (await res.json()) as MediaApiItem & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Media get failed (${res.status})`);
  }

  return mapMediaItem(data);
}

/** accounts.locations.media.patch — recategorize an existing media item. */
export async function patchGbpMediaCategory(
  connection: GbpConnection,
  mediaName: string,
  category: GbpMediaCategory
): Promise<GbpMediaItem> {
  const resource = mediaName.includes("/")
    ? mediaName
    : `${mediaParent(connection)}/media/${mediaName}`;

  const url = new URL(`${GBP_V4}/${resource}`);
  url.searchParams.set("updateMask", "locationAssociation");

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: resource,
      locationAssociation: { category },
    }),
  });

  const data = (await res.json()) as MediaApiItem & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Media patch failed (${res.status})`);
  }

  return mapMediaItem(data);
}

export function summarizeGbpMedia(
  items: GbpMediaItem[],
  totalMediaItemCount?: number
): GbpMediaSummary {
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
    totalMediaItemCount: totalMediaItemCount ?? items.length,
    items,
  };
}

export async function fetchGbpMediaSummary(
  connection: GbpConnection
): Promise<GbpMediaSummary> {
  const listed = await listGbpMedia(connection);
  return summarizeGbpMedia(listed.items, listed.totalMediaItemCount);
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

  return mapMediaItem({
    ...data,
    locationAssociation: data.locationAssociation ?? { category: options.category },
    mediaFormat: data.mediaFormat ?? options.mediaFormat,
    description: data.description ?? options.description,
  });
}

/** accounts.locations.media.startUpload */
export async function startGbpMediaUpload(
  connection: GbpConnection
): Promise<string> {
  const url = `${GBP_V4}/${mediaParent(connection)}/media:startUpload`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Length": "0",
    },
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
  const url = mediaUploadUrl(resourceName);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": contentType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Media byte upload failed (${res.status})`);
  }

  // Google returns { resourceName } on success; step 3 still uses the startUpload ref.
  await res.text().catch(() => "");
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

  if (!data.name) {
    throw new Error("Google accepted the upload but did not return a media item name.");
  }

  return mapMediaItem({
    ...data,
    locationAssociation: data.locationAssociation ?? { category: options.category },
    mediaFormat: data.mediaFormat ?? options.mediaFormat,
    description: data.description ?? options.description,
  });
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
  if (options.mediaFormat === "VIDEO") {
    const videoCheck = validateMediaVideoUpload(file.bytes);
    if (!videoCheck.valid) {
      throw new Error(videoCheck.reason ?? "Video file is too small.");
    }
  } else {
    const sizeCheck = validateMediaUploadBytes(file.bytes);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.reason ?? "Media file is too small.");
    }

    const dimensionCheck = await validateMediaImageDimensions(file.bytes, file.contentType);
    if (!dimensionCheck.valid) {
      throw new Error(dimensionCheck.reason ?? "Media dimensions are too small.");
    }
  }

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
