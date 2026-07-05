import type { GeoGridPoint } from "@/audit/types";
import { offsetLocation } from "@/lib/google/geo-grid";

export interface ServiceAreaBounds {
  /** Corner ring in lat/lng order (closed polygon). */
  ring: Array<{ lat: number; lng: number }>;
  /** Radius in miles from center to outer edge of coverage. */
  radiusMiles: number;
  center: { lat: number; lng: number };
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
