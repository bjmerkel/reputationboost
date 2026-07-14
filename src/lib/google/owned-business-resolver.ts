import type { ClientConfig, GbpIdentity } from "@/audit/types";
import type { GbpLocationProfile } from "./gbp-location";
import {
  primaryCategoryFromTypes,
  secondaryCategoriesFromTypes,
  type PlaceDetails,
} from "./place-details";
import type { GeoLocation } from "./places";

export type OwnedBusinessIdentitySource =
  | "live_gbp"
  | "persisted_gbp"
  | "places"
  | "client";

export interface ResolvedOwnedBusinessIdentity {
  source: OwnedBusinessIdentitySource;
  identity: GbpIdentity;
  openStatus: string | null;
}

function formattedClientAddress(client: ClientConfig): string {
  const { address, city, state, zip } = client.location;
  return `${address}, ${city}, ${state} ${zip}`;
}

/**
 * Phase 2 identity is considered usable when it is tied to a Google place and
 * includes either Google's canonical Maps URL or formatted GBP address.
 */
export function hasPersistedOwnedBusinessIdentity(client: ClientConfig): boolean {
  return Boolean(client.gbpPlaceId && (client.gbpMapsUrl || client.gbpAddress));
}

/** Paid Place Details is reserved for legacy connected rows with no GBP identity. */
export function shouldFetchConnectedPlacesFallback(input: {
  profileAvailable: boolean;
  persistedIdentityAvailable: boolean;
}): boolean {
  return !input.profileAvailable && !input.persistedIdentityAvailable;
}

/** Merge owned-business identity in strict live GBP → persisted GBP → Places order. */
export function resolveOwnedBusinessIdentity(
  client: ClientConfig,
  options: {
    liveProfile?: GbpLocationProfile | null;
    place?: PlaceDetails | null;
    connectionPlaceId?: string;
  } = {}
): ResolvedOwnedBusinessIdentity {
  const live = options.liveProfile;
  const place = options.place;
  const persisted = hasPersistedOwnedBusinessIdentity(client);
  const source: OwnedBusinessIdentitySource = live
    ? "live_gbp"
    : persisted
      ? "persisted_gbp"
      : place
        ? "places"
        : "client";

  const liveSecondary = live?.additionalCategories
    .map((category) => category.displayName)
    .filter(Boolean);
  const secondaryCategories = liveSecondary?.length
    ? liveSecondary
    : client.gbpSecondaryCategories?.length
      ? client.gbpSecondaryCategories
      : secondaryCategoriesFromTypes(place?.types ?? []);

  return {
    source,
    identity: {
      name:
        live?.title ||
        (persisted ? client.name : "") ||
        place?.name ||
        client.name,
      address:
        live?.address || client.gbpAddress || place?.address || formattedClientAddress(client),
      phone:
        live?.phone ||
        (persisted ? client.phone : "") ||
        place?.phone ||
        client.phone ||
        "",
      website:
        live?.website ||
        (persisted ? client.website : "") ||
        place?.website ||
        client.website ||
        "",
      primaryCategory:
        live?.primaryCategory?.displayName ||
        (persisted ? client.industry : "") ||
        (place ? primaryCategoryFromTypes(place.types) : client.industry),
      secondaryCategories,
      placeId:
        live?.placeId ||
        client.gbpPlaceId ||
        options.connectionPlaceId ||
        place?.placeId,
      mapsUrl: live?.mapsUri || client.gbpMapsUrl || place?.mapsUrl,
    },
    openStatus:
      live?.openStatus ??
      client.gbpOpenStatus ??
      place?.businessStatus ??
      null,
  };
}

/** Resolve stored owned-business coordinates without making a geocoding request. */
export function resolveOwnedBusinessCoordinates(
  client: ClientConfig
): GeoLocation | null {
  const serviceAreaCoordinates = client.gbpServiceArea?.businessLatLng;
  if (serviceAreaCoordinates) return serviceAreaCoordinates;

  const { lat, lng } = client.location;
  return lat && lng ? { lat, lng } : null;
}
