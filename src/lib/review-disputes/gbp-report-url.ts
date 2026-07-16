import { googleMapsSearchUrl } from "@/lib/google/maps-url";

const EPHEMERAL_QUERY_PARAMS = ["entry", "g_ep", "g_st", "coh", "hl", "utm_source", "utm_medium", "utm_campaign"];

export interface GoogleMapsReviewsUrlInput {
  name?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  placeId?: string | null;
}

export interface ParsedGoogleMapsPlace {
  name?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  /** Hex CID pair from `!1s0x...:0x...`. */
  cidHex?: string;
  /** Decimal CID from `?cid=`. */
  cidDecimal?: string;
  /** Knowledge Graph MID, e.g. `/g/1tzgkl0l`. */
  kgMid?: string;
}

function isGoogleMapsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("google.") && parsed.pathname.includes("/maps");
  } catch {
    return false;
  }
}

export function stripEphemeralGoogleMapsParams(urlString: string): string {
  try {
    const url = new URL(urlString);
    for (const param of EPHEMERAL_QUERY_PARAMS) {
      url.searchParams.delete(param);
    }
    const cleaned = url.toString();
    return cleaned.endsWith("?") ? cleaned.slice(0, -1) : cleaned;
  } catch {
    return urlString;
  }
}

function decodePlaceSlug(slug: string): string {
  return decodeURIComponent(slug.replace(/\+/g, " ")).trim();
}

function encodePlaceSlug(name: string): string {
  return encodeURIComponent(name.trim()).replace(/%20/g, "+");
}

/** Extract stable place identifiers from a Google Maps URL. */
export function parseGoogleMapsPlaceUrl(urlString: string): ParsedGoogleMapsPlace | null {
  try {
    const url = new URL(urlString);
    if (!isGoogleMapsUrl(urlString)) return null;

    const parsed: ParsedGoogleMapsPlace = {};

    const cidParam = url.searchParams.get("cid");
    if (cidParam && /^\d+$/.test(cidParam)) {
      parsed.cidDecimal = cidParam;
    }

    const pathMatch = url.pathname.match(/\/maps\/place\/([^/@]+)(?:\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+)z)?/i);
    if (pathMatch) {
      parsed.name = decodePlaceSlug(pathMatch[1]);
      if (pathMatch[2] && pathMatch[3]) {
        parsed.lat = Number(pathMatch[2]);
        parsed.lng = Number(pathMatch[3]);
      }
      if (pathMatch[4]) {
        parsed.zoom = Number(pathMatch[4]);
      }
    }

    const dataAndQuery = `${url.pathname}${url.search}`;
    const cidHexMatch = dataAndQuery.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
    if (cidHexMatch) {
      parsed.cidHex = cidHexMatch[1];
    }

    const coordMatch = dataAndQuery.match(/!8m2!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
    if (coordMatch) {
      parsed.lat = Number(coordMatch[1]);
      parsed.lng = Number(coordMatch[2]);
    }

    const kgMatch = dataAndQuery.match(/!16s([^!&?]+)/i);
    if (kgMatch) {
      parsed.kgMid = decodeURIComponent(kgMatch[1]);
    }

    if (
      parsed.name ||
      parsed.cidHex ||
      parsed.cidDecimal ||
      parsed.kgMid ||
      (parsed.lat != null && parsed.lng != null)
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

/** Build a stable reviews-focused Maps URL (no tracking params, `!9m1!1b1` reviews hint). */
export function buildStableGoogleMapsReviewsUrl(parts: ParsedGoogleMapsPlace & { name: string }): string | null {
  const name = parts.name.trim();
  if (!name) return null;

  const lat = parts.lat;
  const lng = parts.lng;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    if (parts.cidDecimal) {
      return `https://www.google.com/maps?cid=${parts.cidDecimal}`;
    }
    return null;
  }

  const zoom = parts.zoom && parts.zoom >= 10 ? parts.zoom : 17;
  const slug = encodePlaceSlug(name);

  let data = "!4m8!3m7";
  if (parts.cidHex) {
    data += `!1s${parts.cidHex}`;
  }
  data += `!8m2!3d${lat}!4d${lng}!9m1!1b1`;
  if (parts.kgMid) {
    data += `!16s${encodeURIComponent(parts.kgMid)}`;
  }
  data += "!5m1!1e2";

  return `https://www.google.com/maps/place/${slug}/@${lat},${lng},${zoom}z/data=${data}`;
}

/**
 * Per-business stable Maps URL that opens the listing on the reviews view.
 * Prefers rebuilding from stored Maps URI so each user lands on their own listing.
 */
export function buildGoogleMapsReviewsDisputeUrl(input: GoogleMapsReviewsUrlInput): string {
  const mapsUrl = input.mapsUrl?.trim();
  if (mapsUrl && isGoogleMapsUrl(mapsUrl)) {
    const stripped = stripEphemeralGoogleMapsParams(mapsUrl);
    const parsed = parseGoogleMapsPlaceUrl(stripped);
    if (parsed) {
      const name = parsed.name || input.name?.trim();
      if (name) {
        const rebuilt = buildStableGoogleMapsReviewsUrl({ ...parsed, name });
        if (rebuilt) return rebuilt;
      }
    }

    if (/!9m1!1b1/i.test(stripped)) {
      return stripped.split("?")[0] ?? stripped;
    }
  }

  const placeId = input.placeId?.trim();
  if (placeId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
  }

  const query = [input.name, input.address].filter(Boolean).join(", ").trim();
  if (query) {
    return googleMapsSearchUrl(query);
  }

  return "https://www.google.com/maps";
}

/** @deprecated Use buildGoogleMapsReviewsDisputeUrl for dispute workflow links. */
export function buildGbpReviewReportUrl(placeId?: string | null): string {
  return buildGoogleMapsReviewsDisputeUrl({ placeId });
}

export function resolveDisputeReportUrl(options: {
  name?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  placeId?: string | null;
}): string {
  return buildGoogleMapsReviewsDisputeUrl(options);
}
