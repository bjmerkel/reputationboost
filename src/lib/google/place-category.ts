import { getGoogleMapsApiKey } from "./config";
import { resolvePrimaryCategoryLabel } from "./place-details";

interface PlacesNewPlaceResponse {
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  error?: { message?: string };
}

function apiKeyOrThrow(): string {
  const key = getGoogleMapsApiKey();
  if (!key) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured.");
  }
  return key;
}

function normalizePlaceResourceId(placeId: string): string {
  const trimmed = placeId.trim();
  return trimmed.startsWith("places/") ? trimmed.slice("places/".length) : trimmed;
}

/** Fetch category fields from Places API (New) for onboarding enrichment. */
export async function fetchPlaceCategoryLabel(placeId: string): Promise<string | null> {
  const key = apiKeyOrThrow();
  const resourceId = normalizePlaceResourceId(placeId);

  const res = await fetch(`https://places.googleapis.com/v1/places/${resourceId}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "primaryType,primaryTypeDisplayName,types",
    },
  });

  const data = (await res.json()) as PlacesNewPlaceResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Place category lookup failed (${res.status})`);
  }

  const label = resolvePrimaryCategoryLabel({
    primaryTypeDisplayName: data.primaryTypeDisplayName?.text,
    primaryType: data.primaryType,
    types: data.types,
  });

  return label || null;
}
