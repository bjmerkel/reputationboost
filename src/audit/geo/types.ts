import type { GeoGridPoint } from "@/audit/types";

export type ZoneDirection =
  | "center"
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";

export type ZoneSeverity = "strong" | "moderate" | "weak" | "critical";

export interface ZoneAction {
  gapId?: string;
  taskId?: string;
  title: string;
  rationale: string;
}

export interface GeoZone {
  id: string;
  label: string;
  direction: ZoneDirection;
  cells: GeoGridPoint[];
  avgRank: number | null;
  coveragePercent: number;
  severity: ZoneSeverity;
  revenueAtRisk: number | null;
  recommendedActions: ZoneAction[];
}

export interface VisibilitySummary {
  keyword: string;
  coveragePercent: number;
  cellsTotal: number;
  cellsInPack: number;
  cellsWeak: number;
  cellsCritical: number;
  zones: GeoZone[];
  totalRevenueAtRisk: number | null;
  totalUpsideAtRank1: number | null;
  hasGridData: boolean;
}
