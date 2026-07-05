import type { GeoGridPoint } from "@/audit/types";
import type { GeoZone, ZoneDirection, ZoneSeverity } from "./types";

const DIRECTION_LABELS: Record<ZoneDirection, string> = {
  center: "At your location",
  N: "North",
  NE: "Northeast",
  E: "East",
  SE: "Southeast",
  S: "South",
  SW: "Southwest",
  W: "West",
  NW: "Northwest",
};

const OCTANT_ORDER: ZoneDirection[] = [
  "center",
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
];

function classifyDirection(northMiles: number, eastMiles: number): ZoneDirection {
  const dist = Math.sqrt(northMiles ** 2 + eastMiles ** 2);
  if (dist < 0.12) return "center";

  const angle = (Math.atan2(eastMiles, northMiles) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "N";
  if (angle >= 22.5 && angle < 67.5) return "NE";
  if (angle >= 67.5 && angle < 112.5) return "E";
  if (angle >= 112.5 && angle < 157.5) return "SE";
  if (angle >= 157.5 || angle < -157.5) return "S";
  if (angle >= -157.5 && angle < -112.5) return "SW";
  if (angle >= -112.5 && angle < -67.5) return "W";
  return "NW";
}

function avgRank(cells: GeoGridPoint[]): number | null {
  const ranks = cells.map((c) => c.rank).filter((r): r is number => r !== null);
  if (ranks.length === 0) return null;
  return Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10;
}

function coveragePercent(cells: GeoGridPoint[]): number {
  if (cells.length === 0) return 0;
  const inPack = cells.filter((c) => c.inLocalPack).length;
  return Math.round((inPack / cells.length) * 100);
}

function classifySeverity(cells: GeoGridPoint[]): ZoneSeverity {
  if (cells.length === 0) return "critical";

  const inPack = cells.filter((c) => c.inLocalPack).length;
  const notFound = cells.filter((c) => c.rank === null).length;
  const coverage = (inPack / cells.length) * 100;

  if (notFound > cells.length / 2) return "critical";
  if (coverage >= 60) return "strong";
  if (coverage >= 20) return "moderate";
  if (coverage > 0) return "weak";
  return "critical";
}

/** Group grid points into compass zones and classify strength. */
export function analyzeGeoZones(grid: GeoGridPoint[]): GeoZone[] {
  if (grid.length === 0) return [];

  const buckets = new Map<ZoneDirection, GeoGridPoint[]>();
  for (const direction of OCTANT_ORDER) {
    buckets.set(direction, []);
  }

  for (const cell of grid) {
    const direction = classifyDirection(cell.offsetNorthMiles, cell.offsetEastMiles);
    buckets.get(direction)!.push(cell);
  }

  const zones: GeoZone[] = [];

  for (const direction of OCTANT_ORDER) {
    const cells = buckets.get(direction)!;
    if (cells.length === 0) continue;

    const id = direction.toLowerCase();
    zones.push({
      id,
      label: DIRECTION_LABELS[direction],
      direction,
      cells,
      avgRank: avgRank(cells),
      coveragePercent: coveragePercent(cells),
      severity: classifySeverity(cells),
      revenueAtRisk: null,
      recommendedActions: [],
    });
  }

  return zones;
}

/** Zones that need attention, sorted by severity then lowest coverage. */
export function weakZones(zones: GeoZone[]): GeoZone[] {
  const severityOrder: Record<ZoneSeverity, number> = {
    critical: 0,
    weak: 1,
    moderate: 2,
    strong: 3,
  };

  return zones
    .filter((z) => z.severity === "critical" || z.severity === "weak")
    .sort((a, b) => {
      const sev = severityOrder[a.severity] - severityOrder[b.severity];
      if (sev !== 0) return sev;
      return a.coveragePercent - b.coveragePercent;
    });
}

export { DIRECTION_LABELS };
