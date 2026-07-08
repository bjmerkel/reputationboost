import { getGoogleBusinessApiKey } from "./business-config";

const PLACE_DETAIL_FIELDS = [
  "name",
  "place_id",
  "formatted_address",
  "formatted_phone_number",
  "international_phone_number",
  "website",
  "url",
  "rating",
  "user_ratings_total",
  "opening_hours",
  "current_opening_hours",
  "secondary_opening_hours",
  "photos",
  "reviews",
  "types",
  "business_status",
  "editorial_summary",
  "wheelchair_accessible_entrance",
].join(",");

export interface PlaceReview {
  authorName: string;
  rating: number;
  text: string;
  publishedAt: string;
  relativeTime: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsUrl: string;
  rating: number | null;
  reviewCount: number;
  types: string[];
  businessStatus: string | null;
  description: string;
  hasHours: boolean;
  hasHolidayHours: boolean;
  photoCount: number;
  reviews: PlaceReview[];
  isOperational: boolean;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    url?: string;
    rating?: number;
    user_ratings_total?: number;
    opening_hours?: { weekday_text?: string[]; periods?: unknown[] };
    current_opening_hours?: { weekday_text?: string[] };
    secondary_opening_hours?: unknown[];
    photos?: unknown[];
    reviews?: Array<{
      author_name?: string;
      rating?: number;
      text?: string;
      time?: number;
      relative_time_description?: string;
    }>;
    types?: string[];
    business_status?: string;
    editorial_summary?: { overview?: string };
  };
  error_message?: string;
}

function apiKeyOrThrow(): string {
  const key = getGoogleBusinessApiKey();
  if (!key) {
    throw new Error("GOOGLE_BUSINESS_API_KEY or GOOGLE_MAPS_API_KEY is not configured.");
  }
  return key;
}

function formatCategory(types: string[]): string {
  return bestCategoryFromTypes(types);
}

const SKIP_PLACE_TYPES = new Set([
  "point_of_interest",
  "establishment",
  "geocode",
  "political",
]);

/** Broad Places types that are often wrong when a more specific type is available. */
const GENERIC_PRIMARY_TYPES = new Set([
  "general_contractor",
  "contractor",
  "store",
  "business_center",
  "corporate_office",
  "finance",
  "food",
  "health",
  "lodging",
  "local_business",
]);

function formatTypeLabel(type: string): string {
  const label = type.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function typeSpecificityScore(type: string): number {
  if (SKIP_PLACE_TYPES.has(type)) return -100;
  if (GENERIC_PRIMARY_TYPES.has(type)) return 1;
  return 10 + type.split("_").length * 5 + type.length;
}

export function bestCategoryFromTypes(types: string[]): string {
  const ranked = types
    .filter((type) => !SKIP_PLACE_TYPES.has(type))
    .sort((a, b) => typeSpecificityScore(b) - typeSpecificityScore(a));

  return ranked[0] ? formatTypeLabel(ranked[0]) : "local business";
}

export function isGenericCategoryLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  if (!normalized || normalized === "local business") return true;
  return GENERIC_PRIMARY_TYPES.has(normalized.replace(/ /g, "_"));
}

export function primaryCategoryFromTypes(types: string[]): string {
  return bestCategoryFromTypes(types);
}

/** Prefer Google's primary type display name (matches GBP category) over generic types[]. */
export function resolvePrimaryCategoryLabel(input: {
  primaryTypeDisplayName?: string | null;
  primaryType?: string | null;
  types?: string[];
}): string {
  const types = input.types ?? [];
  const primaryType = input.primaryType?.trim() ?? "";
  const displayName = input.primaryTypeDisplayName?.trim() ?? "";

  if (primaryType && GENERIC_PRIMARY_TYPES.has(primaryType) && types.length > 0) {
    const specific = bestCategoryFromTypes(types);
    if (!isGenericCategoryLabel(specific)) return specific;
  }

  if (displayName && (!primaryType || !GENERIC_PRIMARY_TYPES.has(primaryType))) {
    return displayName;
  }

  if (primaryType) return formatTypeLabel(primaryType);

  return bestCategoryFromTypes(types);
}

export function secondaryCategoriesFromTypes(types: string[]): string[] {
  const skip = new Set(["point_of_interest", "establishment", "geocode"]);
  return types
    .filter((t) => !skip.has(t))
    .slice(1, 4)
    .map((t) => t.replace(/_/g, " "));
}

/**
 * Places API Place Details — public GBP fields available with an API key + place_id.
 * https://developers.google.com/maps/documentation/places/web-service/details
 */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const key = apiKeyOrThrow();
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", PLACE_DETAIL_FIELDS);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const data = (await res.json()) as GooglePlaceDetailsResponse;

  if (data.status !== "OK" || !data.result) {
    throw new Error(
      `Place Details failed for ${placeId}: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`
    );
  }

  const r = data.result;
  const reviews: PlaceReview[] = (r.reviews ?? []).map((review) => ({
    authorName: review.author_name ?? "Anonymous",
    rating: review.rating ?? 0,
    text: review.text ?? "",
    publishedAt: review.time
      ? new Date(review.time * 1000).toISOString()
      : new Date().toISOString(),
    relativeTime: review.relative_time_description ?? "",
  }));

  return {
    placeId: r.place_id ?? placeId,
    name: r.name ?? "",
    address: r.formatted_address ?? "",
    phone: r.formatted_phone_number ?? r.international_phone_number ?? "",
    website: r.website ?? "",
    mapsUrl: r.url ?? "",
    rating: r.rating ?? null,
    reviewCount: r.user_ratings_total ?? 0,
    types: r.types ?? [],
    businessStatus: r.business_status ?? null,
    description: r.editorial_summary?.overview ?? "",
    hasHours: Boolean(r.opening_hours?.periods?.length ?? r.current_opening_hours?.weekday_text?.length),
    hasHolidayHours: Boolean(r.secondary_opening_hours?.length),
    photoCount: r.photos?.length ?? 0,
    reviews,
    isOperational: r.business_status !== "CLOSED_PERMANENTLY",
  };
}
