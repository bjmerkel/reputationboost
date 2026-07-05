export type {
  GeoZone,
  VisibilitySummary,
  ZoneAction,
  ZoneDirection,
  ZoneSeverity,
} from "./types";
export { analyzeGeoZones, weakZones, DIRECTION_LABELS } from "./zone-analyzer";
export { enrichZonesWithRevenue, estimateZoneRevenue } from "./zone-revenue";
export { mapZoneActions } from "./zone-task-mapper";
export {
  aggregateGridCoverage,
  buildVisibilitySummary,
  type BuildVisibilitySummaryInput,
} from "./visibility-summary";
export { gridCoveragePercent, geoGridToRankRows, rankRowsToGeoGrid, inferGridMetaFromPoints } from "./grid-coverage";
export {
  computeGridDiff,
  diffCellColor,
  type CellDiff,
  type CellDiffStatus,
  type GridDiff,
} from "./grid-diff";
export {
  analyzeCompetitorDominance,
  cellDominanceLabel,
  topCompetitorThreat,
  type CompetitorDominance,
} from "./competitor-dominance";
export { buildCompetitorTerritories, type CompetitorTerritory } from "./competitor-territories";
export { serviceAreaFromGrid, serviceAreaFromGbpPlaces, type ServiceAreaBounds } from "./service-area";
