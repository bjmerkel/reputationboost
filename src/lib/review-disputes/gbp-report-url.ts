import { googleMapsSearchUrl } from "@/lib/google/maps-url";
import type { ClientConfig, FullAuditPayload } from "@/audit/types";

const EPHEMERAL_QUERY_PARAMS = [
  "entry",
  "g_ep",
  "g_st",
  "coh",
  "hl",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];

export interface GoogleMapsReviewsUrlInput {
  name?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
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
    if (!parsed.hostname.includes("google.")) return false;
    return (
      parsed.pathname.includes("/maps") ||
      parsed.hostname.includes("maps.google") ||
      parsed.searchParams.has("cid")
    );
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

function isValidCoord(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
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

    const pathMatch = url.pathname.match(
      /\/maps\/place\/([^/@]+)(?:\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+)z)?/i
    );
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

/**
 * Official Places API `reviewsUri` format — opens the reviews tab directly.
 * @see https://developers.google.com/maps/architecture/maps-url
 */
export function buildGooglePlacesReviewsUri(cidHex: string): string {
  return `https://www.google.com/maps/place//data=!4m4!3m3!1s${cidHex}!9m1!1b1`;
}

/**
 * Google Search local reviews deep link — reliably opens the reviews panel.
 */
export function buildGoogleLocalReviewsUrl(placeId: string, name?: string | null): string {
  const url = new URL("https://search.google.com/local/reviews");
  url.searchParams.set("placeid", placeId.trim());
  const label = name?.trim();
  if (label) {
    url.searchParams.set("q", label);
  }
  return url.toString();
}

/** Build a stable reviews-focused Maps URL (no tracking params, `!9m1!1b1` reviews hint). */
export function buildStableGoogleMapsReviewsUrl(
  parts: ParsedGoogleMapsPlace & { name: string }
): string | null {
  if (parts.cidHex) {
    return buildGooglePlacesReviewsUri(parts.cidHex);
  }

  const name = parts.name.trim();
  if (!name) return null;

  const lat = parts.lat;
  const lng = parts.lng;
  if (!isValidCoord(lat) || !isValidCoord(lng)) {
    return null;
  }

  const zoom = parts.zoom && parts.zoom >= 10 ? parts.zoom : 17;
  const slug = encodePlaceSlug(name);

  let data = "!4m8!3m7";
  data += `!8m2!3d${lat}!4d${lng}!9m1!1b1`;
  if (parts.kgMid) {
    data += `!16s${encodeURIComponent(parts.kgMid)}`;
  }
  data += "!5m1!1e2";

  let url = `https://www.google.com/maps/place/${slug}/@${lat},${lng},${zoom}z/data=${data}`;
  if (parts.cidDecimal) {
    url += `?cid=${parts.cidDecimal}`;
  }
  return url;
}

function mergeParsedWithInput(
  parsed: ParsedGoogleMapsPlace | null,
  input: GoogleMapsReviewsUrlInput
): ParsedGoogleMapsPlace {
  return {
    ...parsed,
    name: parsed?.name || input.name?.trim() || undefined,
    lat: parsed?.lat ?? input.lat ?? undefined,
    lng: parsed?.lng ?? input.lng ?? undefined,
  };
}

/**
 * Per-business stable URL that opens the listing on the reviews view.
 * Prefers Google's official reviews deep links over overview-style place URLs.
 */
export function buildGoogleMapsReviewsDisputeUrl(input: GoogleMapsReviewsUrlInput): string {
  const placeId = input.placeId?.trim();
  if (placeId) {
    return buildGoogleLocalReviewsUrl(placeId, input.name);
  }

  const mapsUrl = input.mapsUrl?.trim();
  let parsed: ParsedGoogleMapsPlace | null = null;
  if (mapsUrl && isGoogleMapsUrl(mapsUrl)) {
    const stripped = stripEphemeralGoogleMapsParams(mapsUrl);
    parsed = mergeParsedWithInput(parseGoogleMapsPlaceUrl(stripped), input);

    if (parsed.cidHex) {
      return buildGooglePlacesReviewsUri(parsed.cidHex);
    }
  } else {
    parsed = mergeParsedWithInput(null, input);
  }

  const name = parsed.name || input.name?.trim();
  if (name) {
    const rebuilt = buildStableGoogleMapsReviewsUrl({ ...parsed, name });
    if (rebuilt) return rebuilt;
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

export function resolveDisputeReportUrl(options: GoogleMapsReviewsUrlInput): string {
  return buildGoogleMapsReviewsDisputeUrl(options);
}

export function resolveBusinessCoordinates(
  business: Pick<ClientConfig, "location" | "gbpServiceArea">
): { lat?: number; lng?: number } {
  const lat = business.gbpServiceArea?.businessLatLng?.lat ?? business.location?.lat;
  const lng = business.gbpServiceArea?.businessLatLng?.lng ?? business.location?.lng;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }
  return {};
}

export function resolveDisputeReportUrlFromContext(options: {
  audit?: FullAuditPayload | null;
  business: ClientConfig;
}): string {
  const { audit, business } = options;
  const coords = resolveBusinessCoordinates(business);
  return resolveDisputeReportUrl({
    name: audit?.clientName ?? business.name,
    address: audit?.gbp.identity.address ?? business.gbpAddress,
    mapsUrl: audit?.gbp.identity.mapsUrl ?? business.gbpMapsUrl,
    placeId: business.gbpPlaceId ?? audit?.gbp.identity.placeId,
    lat: coords.lat,
    lng: coords.lng,
  });
}
