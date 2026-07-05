import type { GeoGridPoint } from "@/audit/types";

export interface CompetitorTerritory {
  placeId: string;
  name: string;
  cellCount: number;
  ring: Array<{ lat: number; lng: number }>;
  color: string;
}

const TERRITORY_COLORS = ["#ea4335", "#fbbc04", "#9334e6", "#ff6d01", "#4285f4"];

function territoryRing(cells: GeoGridPoint[]): Array<{ lat: number; lng: number }> {
  const lats = cells.map((c) => c.lat);
  const lngs = cells.map((c) => c.lng);
  const padLat = 0.002;
  const padLng = 0.002;
  const minLat = Math.min(...lats) - padLat;
  const maxLat = Math.max(...lats) + padLat;
  const minLng = Math.min(...lngs) - padLng;
  const maxLng = Math.max(...lngs) + padLng;

  return [
    { lat: minLat, lng: minLng },
    { lat: minLat, lng: maxLng },
    { lat: maxLat, lng: maxLng },
    { lat: maxLat, lng: minLng },
  ];
}

/** Cluster weak cells by local pack leader for territory shading on the map. */
export function buildCompetitorTerritories(grid: GeoGridPoint[]): CompetitorTerritory[] {
  const byLeader = new Map<string, { name: string; cells: GeoGridPoint[] }>();

  for (const cell of grid) {
    if (cell.rank !== null && cell.rank <= 3) continue;
    const leader = cell.localPack?.[0];
    if (!leader) continue;

    const existing = byLeader.get(leader.placeId) ?? { name: leader.name, cells: [] };
    existing.cells.push(cell);
    byLeader.set(leader.placeId, existing);
  }

  return [...byLeader.entries()]
    .filter(([, data]) => data.cells.length >= 2)
    .map(([placeId, data], index) => ({
      placeId,
      name: data.name,
      cellCount: data.cells.length,
      ring: territoryRing(data.cells),
      color: TERRITORY_COLORS[index % TERRITORY_COLORS.length]!,
    }))
    .sort((a, b) => b.cellCount - a.cellCount);
}
