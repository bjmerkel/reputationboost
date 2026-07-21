import type { ZoneDirection } from "@/audit/geo/types";

export interface GridCellOffset {
  gridNorth: number;
  gridEast: number;
}

/** Offset a customer lat/lng from the business center in north/east miles. */
export function latLngToGridOffset(
  customer: { lat: number; lng: number },
  center: { lat: number; lng: number }
): { northMiles: number; eastMiles: number } {
  const latPerMile = 1 / 69;
  const lngPerMile = 1 / (69 * Math.cos((center.lat * Math.PI) / 180));
  return {
    northMiles: (customer.lat - center.lat) / latPerMile,
    eastMiles: (customer.lng - center.lng) / lngPerMile,
  };
}

/** Snap a continuous offset to the nearest grid cell center. */
export function snapToNearestGridCell(
  northMiles: number,
  eastMiles: number,
  spacingMiles: number
): GridCellOffset {
  if (spacingMiles <= 0) {
    return {
      gridNorth: roundGridOffset(northMiles),
      gridEast: roundGridOffset(eastMiles),
    };
  }

  return {
    gridNorth: roundGridOffset(Math.round(northMiles / spacingMiles) * spacingMiles),
    gridEast: roundGridOffset(Math.round(eastMiles / spacingMiles) * spacingMiles),
  };
}

export function roundGridOffset(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Classify a grid cell into a compass zone (matches zone-analyzer octants). */
export function classifyCellZone(gridNorth: number, gridEast: number): ZoneDirection {
  const dist = Math.sqrt(gridNorth ** 2 + gridEast ** 2);
  if (dist < 0.12) return "center";

  const angle = (Math.atan2(gridEast, gridNorth) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "N";
  if (angle >= 22.5 && angle < 67.5) return "NE";
  if (angle >= 67.5 && angle < 112.5) return "E";
  if (angle >= 112.5 && angle < 157.5) return "SE";
  if (angle >= 157.5 || angle < -157.5) return "S";
  if (angle >= -157.5 && angle < -112.5) return "SW";
  if (angle >= -112.5 && angle < -67.5) return "W";
  return "NW";
}

export function customerLatLngToGridCell(
  customer: { lat: number; lng: number },
  center: { lat: number; lng: number },
  spacingMiles: number
): GridCellOffset & { zoneDirection: ZoneDirection } {
  const offset = latLngToGridOffset(customer, center);
  const cell = snapToNearestGridCell(offset.northMiles, offset.eastMiles, spacingMiles);
  return {
    ...cell,
    zoneDirection: classifyCellZone(cell.gridNorth, cell.gridEast),
  };
}

/** Find the grid cell in a collected geo grid closest to a target offset. */
export function findNearestGridPoint<T extends { offsetNorthMiles: number; offsetEastMiles: number }>(
  grid: T[],
  targetNorth: number,
  targetEast: number
): T | null {
  if (grid.length === 0) return null;

  let best = grid[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const point of grid) {
    const dist =
      (point.offsetNorthMiles - targetNorth) ** 2 + (point.offsetEastMiles - targetEast) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  }

  return best;
}
