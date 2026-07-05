import type { GeoGridPoint } from "@/audit/types";
import { offsetLocation } from "@/lib/google/geo-grid";

export interface ServiceAreaBounds {
  /** Corner ring in lat/lng order (closed polygon). */
  ring: Array<{ lat: number; lng: number }>;
  /** Radius in miles from center to outer edge of coverage. */
  radiusMiles: number;
  center: { lat: number; lng: number };
}

/** Approximate radius around each GBP service-area place (city/region). */
export const GBP_SERVICE_PLACE_RADIUS_MILES = 10;

export interface GeocodedServiceAreaPlace {
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
}

/** Infer the rank-tracking service area from geo-grid cell offsets. */
export function serviceAreaFromGrid(
  center: { lat: number; lng: number },
  grid: GeoGridPoint[]
): ServiceAreaBounds | null {
  if (grid.length === 0) return null;

  const norths = grid.map((p) => p.offsetNorthMiles);
  const easts = grid.map((p) => p.offsetEastMiles);
  const minNorth = Math.min(...norths);
  const maxNorth = Math.max(...norths);
  const minEast = Math.min(...easts);
  const maxEast = Math.max(...easts);

  const corners = [
    offsetLocation(center, minNorth, minEast),
    offsetLocation(center, minNorth, maxEast),
    offsetLocation(center, maxNorth, maxEast),
    offsetLocation(center, maxNorth, minEast),
  ];

  const radiusMiles = Math.max(
    ...grid.map((p) => Math.hypot(p.offsetNorthMiles, p.offsetEastMiles))
  );

  return {
    center,
    radiusMiles,
    ring: corners,
  };
}

/** Bounding ring around geocoded GBP service-area places with padding. */
export function serviceAreaFromGbpPlaces(
  places: GeocodedServiceAreaPlace[],
  padMiles = GBP_SERVICE_PLACE_RADIUS_MILES
): ServiceAreaBounds | null {
  if (places.length === 0) return null;

  const latPerMile = 1 / 69;
  const centerLat = places.reduce((sum, p) => sum + p.lat, 0) / places.length;
  const lngPerMile = 1 / (69 * Math.cos((centerLat * Math.PI) / 180));

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const place of places) {
    minLat = Math.min(minLat, place.lat - padMiles * latPerMile);
    maxLat = Math.max(maxLat, place.lat + padMiles * latPerMile);
    minLng = Math.min(minLng, place.lng - padMiles * lngPerMile);
    maxLng = Math.max(maxLng, place.lng + padMiles * lngPerMile);
  }

  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const radiusMiles =
    Math.max(
      ...places.map((p) =>
        Math.hypot(
          (p.lat - center.lat) / latPerMile,
          (p.lng - center.lng) / lngPerMile
        )
      )
    ) + padMiles;

  return {
    center,
    radiusMiles,
    ring: [
      { lat: minLat, lng: minLng },
      { lat: minLat, lng: maxLng },
      { lat: maxLat, lng: maxLng },
      { lat: maxLat, lng: minLng },
    ],
  };
}
