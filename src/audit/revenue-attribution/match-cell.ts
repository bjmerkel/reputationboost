import type { ClientConfig } from "@/audit/types";
import {
  classifyCellZone,
  customerLatLngToGridCell,
} from "@/lib/geo/customer-to-cell";
import { resolveGridProfile } from "@/lib/google/geo-grid";
import type { RevenueMatchMethod } from "./types";

export interface CellMatchResult {
  gridNorth: number | null;
  gridEast: number | null;
  zone: string | null;
}

export function matchTransactionToCell(
  geo: {
    jobLat?: number;
    jobLng?: number;
  },
  business: Pick<ClientConfig, "location" | "heatmapProfile">
): CellMatchResult {
  const lat = business.location.lat;
  const lng = business.location.lng;
  if (lat == null || lng == null) {
    return { gridNorth: null, gridEast: null, zone: null };
  }

  if (geo.jobLat == null || geo.jobLng == null) {
    return { gridNorth: null, gridEast: null, zone: null };
  }

  const profile = resolveGridProfile(business.heatmapProfile ?? "compact");
  const cell = customerLatLngToGridCell(
    { lat: geo.jobLat, lng: geo.jobLng },
    { lat, lng },
    profile.spacing
  );

  return {
    gridNorth: cell.gridNorth,
    gridEast: cell.gridEast,
    zone: classifyCellZone(cell.gridNorth, cell.gridEast),
  };
}

export function cellRevenueKey(
  keyword: string,
  gridNorth: number,
  gridEast: number
): string {
  return `${keyword.toLowerCase()}|${gridNorth}|${gridEast}`;
}

export function isHighConfidenceMatch(method: RevenueMatchMethod | null): boolean {
  return method === "service_keyword" || method === "call_log" || method === "lead_source";
}
