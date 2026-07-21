"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompetitorDominance } from "@/audit/geo/competitor-dominance";
import { cellDominanceLabel } from "@/audit/geo/competitor-dominance";
import { buildCompetitorTerritories } from "@/audit/geo/competitor-territories";
import type { VisibilitySummary } from "@/audit/geo/types";
import { serviceAreaFromGrid } from "@/audit/geo/service-area";
import type { GridDiff } from "@/audit/geo/grid-diff";
import { diffCellColor } from "@/audit/geo/grid-diff";
import type { CompetitorProfile, GeoGridPoint, GbpSnapshot, KeywordRankSnapshot } from "@/audit/types";
import {
  buildClientProfileSnapshot,
  computeLeaderDelta,
} from "@/audit/autopilot/leader-delta-engine";
import { isLosingCell } from "@/audit/autopilot/cell-loss-classifier";
import {
  buildCompetitorProfileIndex,
  resolveCompetitorProfile,
} from "@/audit/autopilot/competitor-profile-index";
import CellDetailModal from "@/components/platform/heatmap/CellDetailModal";
import CoverageBadge from "@/components/platform/heatmap/CoverageBadge";
import GridDiffControls from "@/components/platform/heatmap/GridDiffControls";
import { rankColor } from "@/components/platform/heatmap/rank-colors";
import VisibilityInsightPanel from "@/components/platform/heatmap/VisibilityInsightPanel";
import MapGuidePanel from "@/components/platform/MapGuidePanel";
import { ZONE_SEVERITY_COLORS } from "@/components/platform/heatmap/zone-colors";
import MapLayerControls, {
  createDefaultMapLayers,
  type MapLayerState,
} from "@/components/platform/MapLayerControls";
import { getPlaceGeometry, storedPlaceGeometry } from "@/lib/google/place-geometry";
import { loadGoogleMaps } from "@/lib/google/maps-loader";
import {
  createBusinessPinIcon,
  createCompetitorMarkerIcon,
  createGoogleMapOptions,
} from "@/lib/google/map-marker-icons";
import { HEATMAP_FLAGS } from "@/lib/feature-flags";
import { competitorMapRank } from "@/lib/google/local-rankings";
import { isRadialRankGrid } from "@/lib/google/radial-rankings";

export { rankColor } from "@/components/platform/heatmap/rank-colors";

function milesToMeters(miles: number): number {
  return Math.round(miles * 1609.34);
}

const DEFAULT_MAP_ZOOM = 13;
const RESIZE_DEBOUNCE_MS = 150;

function preserveMapView(map: google.maps.Map, center: google.maps.LatLngLiteral) {
  const zoom = map.getZoom() ?? DEFAULT_MAP_ZOOM;
  const currentCenter = map.getCenter();

  google.maps.event.trigger(map, "resize");

  if (currentCenter) {
    map.setCenter(currentCenter);
  } else {
    map.setCenter(center);
  }
  map.setZoom(zoom);
}

interface RankingMapProps {
  lat: number;
  lng: number;
  address: string;
  businessName: string;
  keywordRank?: KeywordRankSnapshot;
  competitors?: CompetitorProfile[];
  /** Client GBP snapshot for beat-the-leader diffs in cell detail. */
  gbp?: GbpSnapshot;
  activeKeyword?: string;
  /** Skip authenticated grid fetches (marketing preview). */
  disableGridFetch?: boolean;
  /** When true, fall back to live Places grid if no ingested snapshot exists. */
  allowLivePlacesGrid?: boolean;
  visibilitySummary?: VisibilitySummary;
  selectedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
  topCompetitorThreat?: CompetitorDominance | null;
  competitorThreats?: CompetitorDominance[];
  onOpenPlan?: () => void;
  currency?: string;
  clientId?: string;
  gridDiff?: GridDiff | null;
  diffActive?: boolean;
  onDiffChange?: (diff: GridDiff | null, active: boolean) => void;
}

export default function RankingMap({
  lat,
  lng,
  address,
  businessName,
  keywordRank,
  competitors = [],
  gbp,
  activeKeyword,
  disableGridFetch = false,
  allowLivePlacesGrid = false,
  visibilitySummary,
  selectedZoneId = null,
  onZoneSelect,
  onOpenPlan,
  topCompetitorThreat,
  competitorThreats = [],
  currency = "USD",
  clientId,
  gridDiff = null,
  diffActive = false,
  onDiffChange,
}: RankingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const businessMarkerRef = useRef<google.maps.Marker | null>(null);
  const competitorMarkersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const gridCirclesRef = useRef<google.maps.Circle[]>([]);
  const dominanceMarkersRef = useRef<google.maps.Marker[]>([]);
  const gridServiceAreaRef = useRef<google.maps.Polygon | null>(null);
  const gbpServiceAreaRef = useRef<google.maps.Polygon | null>(null);
  const territoryPolygonsRef = useRef<google.maps.Polygon[]>([]);
  const gridListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const centerRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastFittedKeywordRef = useRef<string | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [layers, setLayers] = useState<MapLayerState>(createDefaultMapLayers);
  const [gridPoints, setGridPoints] = useState<GeoGridPoint[] | undefined>(
    disableGridFetch ? keywordRank?.geoGrid : undefined
  );
  const [gridLoading, setGridLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<GeoGridPoint | null>(null);
  const [gbpServiceAreaRing, setGbpServiceAreaRing] = useState<
    Array<{ lat: number; lng: number }> | null
  >(null);

  const competitorIndex = useMemo(() => {
    if (!activeKeyword || competitors.length === 0) return null;
    return buildCompetitorProfileIndex([
      {
        collectedAt: new Date().toISOString(),
        keyword: activeKeyword,
        localPack: competitors,
        widerRadius: [],
        textSearchFallback: [],
        nearbyHasResults: true,
        competitors,
      },
    ]);
  }, [activeKeyword, competitors]);

  const selectedLeaderDelta = useMemo(() => {
    if (!selectedCell || !gbp || !activeKeyword || !isLosingCell(selectedCell)) {
      return null;
    }
    const leaderPlaceId = selectedCell.localPack?.[0]?.placeId;
    const leaderProfile = leaderPlaceId
      ? resolveCompetitorProfile(competitorIndex ?? new Map(), activeKeyword, leaderPlaceId)
      : null;
    return computeLeaderDelta({
      keyword: activeKeyword,
      cell: selectedCell,
      client: buildClientProfileSnapshot(gbp),
      leaderProfile,
    });
  }, [selectedCell, gbp, activeKeyword, competitorIndex]);

  const competitorTerritories = useMemo(() => {
    if (!gridPoints?.length || !HEATMAP_FLAGS.competitorTerritories) return [];
    return buildCompetitorTerritories(gridPoints);
  }, [gridPoints]);

  const selectedZoneCells = useMemo(() => {
    if (!HEATMAP_FLAGS.zoneHighlights || !selectedZoneId || !visibilitySummary?.hasGridData) {
      return null;
    }
    const zone = visibilitySummary.zones.find((z) => z.id === selectedZoneId);
    if (!zone) return null;
    return new Set(
      zone.cells.map((c) => `${c.offsetNorthMiles.toFixed(3)}:${c.offsetEastMiles.toFixed(3)}`)
    );
  }, [selectedZoneId, visibilitySummary]);

  useEffect(() => {
    if (disableGridFetch) {
      setGridPoints(keywordRank?.geoGrid);
      setSelectedCell(null);
      return;
    }
    setGridPoints(keywordRank?.geoGrid);
    setSelectedCell(null);
  }, [disableGridFetch, keywordRank?.geoGrid, keywordRank?.keyword]);

  useEffect(() => {
    if (!layers.showHeatmap || !activeKeyword || !ready || disableGridFetch) return;

    let cancelled = false;

    async function loadGrid() {
      setGridLoading(true);
      try {
        if (clientId) {
          const storedRes = await fetch(
            `/api/metrics/grid-latest?clientId=${encodeURIComponent(clientId)}&keyword=${encodeURIComponent(activeKeyword!)}`
          );
          const stored = (await storedRes.json()) as {
            geoGrid?: GeoGridPoint[];
          };
          if (!cancelled && storedRes.ok && stored.geoGrid?.length) {
            setGridPoints(stored.geoGrid);
            return;
          }
        }

        if (keywordRank?.geoGrid?.length) {
          if (!cancelled) setGridPoints(keywordRank.geoGrid);
          return;
        }

        if (!allowLivePlacesGrid) return;

        const res = await fetch(
          `/api/places/grid?keyword=${encodeURIComponent(activeKeyword!)}&radiusMiles=${layers.heatmapSearchRadiusMiles}`
        );
        const data = (await res.json()) as { geoGrid?: GeoGridPoint[] };
        if (!cancelled && res.ok && data.geoGrid?.length) {
          setGridPoints(data.geoGrid);
        }
      } catch {
        // Heatmap unavailable without grid data
      } finally {
        if (!cancelled) setGridLoading(false);
      }
    }

    void loadGrid();
    return () => {
      cancelled = true;
    };
  }, [
    layers.showHeatmap,
    layers.heatmapSearchRadiusMiles,
    activeKeyword,
    ready,
    disableGridFetch,
    allowLivePlacesGrid,
    clientId,
    keywordRank?.geoGrid,
  ]);

  useEffect(() => {
    if (!clientId || !HEATMAP_FLAGS.gbpServiceArea || disableGridFetch) {
      setGbpServiceAreaRing(null);
      return;
    }

    let cancelled = false;

    async function loadGbpServiceArea() {
      try {
        const res = await fetch(
          `/api/metrics/service-area?clientId=${encodeURIComponent(clientId!)}`
        );
        const data = (await res.json()) as {
          source?: string | null;
          ring?: Array<{ lat: number; lng: number }>;
        };
        if (!cancelled && res.ok && data.source === "gbp" && data.ring?.length) {
          setGbpServiceAreaRing(data.ring);
        } else if (!cancelled) {
          setGbpServiceAreaRing(null);
        }
      } catch {
        if (!cancelled) setGbpServiceAreaRing(null);
      }
    }

    void loadGbpServiceArea();
    return () => {
      cancelled = true;
    };
  }, [clientId, disableGridFetch]);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: number | null = null;

    async function syncMap() {
      const container = mapContainerRef.current;
      const mapDiv = mapRef.current;
      if (!container || !mapDiv || cancelled) return;

      const { offsetWidth: width, offsetHeight: height } = container;
      if (width === 0 || height === 0) return;

      const last = lastSizeRef.current;
      const sizeChanged = last.width !== width || last.height !== height;
      if (!sizeChanged && mapInstance.current) return;
      lastSizeRef.current = { width, height };

      try {
        const google = await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        let center: google.maps.LatLngLiteral = { lat, lng };

        if (!lat || !lng) {
          const geocoder = new google.maps.Geocoder();
          const geocoded = await new Promise<google.maps.LatLngLiteral | null>((resolve) => {
            geocoder.geocode({ address }, (results, status) => {
              if (status === "OK" && results?.[0]) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
              } else {
                resolve(null);
              }
            });
          });
          if (!geocoded) {
            setError("Could not locate business on the map.");
            return;
          }
          center = geocoded;
        }

        centerRef.current = center;

        if (!mapInstance.current) {
          mapInstance.current = new google.maps.Map(mapDiv, createGoogleMapOptions(google, center));

          businessMarkerRef.current = new google.maps.Marker({
            position: center,
            map: mapInstance.current,
            title: businessName,
            icon: createBusinessPinIcon(google),
            zIndex: 1000,
          });

          setReady(true);
          setMapVisible(true);
        } else {
          preserveMapView(mapInstance.current, center);
          businessMarkerRef.current?.setPosition(center);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Map failed to load");
        }
      }
    }

    function scheduleSync() {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void syncMap();
      }, RESIZE_DEBOUNCE_MS);
    }

    const container = mapContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(scheduleSync);
    observer.observe(container);
    scheduleSync();

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      observer.disconnect();
      mapInstance.current = null;
      businessMarkerRef.current = null;
      lastSizeRef.current = { width: 0, height: 0 };
      setReady(false);
      setMapVisible(false);
    };
  }, [lat, lng, address, businessName]);

  useEffect(() => {
    if (!ready || !mapInstance.current || !centerRef.current) return;

    const google = window.google;
    if (!google) return;

    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];

    if (!keywordRank) return;

    for (const point of keywordRank.geoRanks) {
      if (!layers.enabledRadii.has(point.distanceMiles)) continue;

      const color = rankColor(point.rank);
      const circle = new google.maps.Circle({
        map: mapInstance.current,
        center: centerRef.current,
        radius: milesToMeters(point.distanceMiles),
        fillColor: color,
        fillOpacity: 0.06,
        strokeColor: color,
        strokeOpacity: 0.45,
        strokeWeight: 1.5,
      });
      circlesRef.current.push(circle);
    }
  }, [keywordRank, ready, layers.enabledRadii]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;

    gridCirclesRef.current.forEach((c) => c.setMap(null));
    gridCirclesRef.current = [];
    gridListenersRef.current.forEach((l) => l.remove());
    gridListenersRef.current = [];
    dominanceMarkersRef.current.forEach((m) => m.setMap(null));
    dominanceMarkersRef.current = [];

    if (!layers.showHeatmap) return;

    const google = window.google;
    if (!google) return;
    const map = mapInstance.current;

    if (diffActive && gridDiff?.cellDiffs.length) {
      for (const cell of gridDiff.cellDiffs) {
        const color = diffCellColor(cell.status);
        const circle = new google.maps.Circle({
          map,
          center: { lat: cell.lat, lng: cell.lng },
          radius: 140,
          fillColor: color,
          fillOpacity: 0.6,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: cell.status === "improved" || cell.status === "regressed" ? 2 : 1,
          clickable: false,
          zIndex: 150,
        });
        gridCirclesRef.current.push(circle);
      }
      return;
    }

    if (!gridPoints?.length) return;

    const useSmoothBlend =
      HEATMAP_FLAGS.heatmapLayer && layers.heatmapStyle === "gradient";

    for (const point of gridPoints) {
      const cellKey = `${point.offsetNorthMiles.toFixed(3)}:${point.offsetEastMiles.toFixed(3)}`;
      const inSelectedZone = selectedZoneCells?.has(cellKey) ?? false;
      const dimmed = selectedZoneCells != null && !inSelectedZone;

      let color = rankColor(point.rank);
      let fillOpacity = useSmoothBlend ? 0.38 : 0.55;
      let strokeWeight = useSmoothBlend ? 0 : 1;
      let strokeOpacity = useSmoothBlend ? 0 : 0.85;
      let radius = useSmoothBlend ? 260 : 140;

      if (inSelectedZone && visibilitySummary) {
        const zone = visibilitySummary.zones.find((z) => z.id === selectedZoneId);
        if (zone) {
          color = ZONE_SEVERITY_COLORS[zone.severity].stroke;
          fillOpacity = useSmoothBlend ? 0.5 : 0.7;
          strokeWeight = 2.5;
          strokeOpacity = 1;
          radius = 155;
        }
      } else if (dimmed) {
        fillOpacity = useSmoothBlend ? 0.12 : 0.2;
        strokeOpacity = 0.35;
      }

      const circle = new google.maps.Circle({
        map,
        center: { lat: point.lat, lng: point.lng },
        radius,
        fillColor: color,
        fillOpacity,
        strokeColor: color,
        strokeOpacity,
        strokeWeight,
        clickable: true,
        zIndex: inSelectedZone ? 200 : 100,
      });

      const listener = circle.addListener("click", () => setSelectedCell(point));
      gridListenersRef.current.push(listener);
      gridCirclesRef.current.push(circle);

      if (layers.showCompetitorZones && HEATMAP_FLAGS.competitorDominance) {
        const label = cellDominanceLabel(point);
        if (label) {
          const marker = new google.maps.Marker({
            map,
            position: { lat: point.lat, lng: point.lng },
            clickable: false,
            label: {
              text: label,
              color: "#202124",
              fontSize: "9px",
              fontWeight: "bold",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
            },
            zIndex: 300,
          });
          dominanceMarkersRef.current.push(marker);
        }
      }
    }
  }, [
    gridPoints,
    layers.showHeatmap,
    layers.heatmapStyle,
    layers.showCompetitorZones,
    ready,
    selectedZoneCells,
    selectedZoneId,
    visibilitySummary,
    diffActive,
    gridDiff,
  ]);

  useEffect(() => {
    if (
      !ready ||
      !layers.showHeatmap ||
      !mapInstance.current ||
      !centerRef.current ||
      !gridPoints?.length ||
      !isRadialRankGrid(gridPoints) ||
      lastFittedKeywordRef.current === activeKeyword
    ) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(centerRef.current);
    for (const point of gridPoints) {
      bounds.extend({ lat: point.lat, lng: point.lng });
    }
    mapInstance.current.fitBounds(bounds, 48);
    lastFittedKeywordRef.current = activeKeyword ?? null;
  }, [activeKeyword, gridPoints, layers.showHeatmap, ready]);

  useEffect(() => {
    gridServiceAreaRef.current?.setMap(null);
    gbpServiceAreaRef.current?.setMap(null);
    gridServiceAreaRef.current = null;
    gbpServiceAreaRef.current = null;

    if (!ready || !mapInstance.current || !layers.showServiceArea) return;
    if (!HEATMAP_FLAGS.serviceAreaOverlay) return;

    const google = window.google;
    if (!google) return;
    const map = mapInstance.current;

    if (gbpServiceAreaRing?.length && HEATMAP_FLAGS.gbpServiceArea) {
      gbpServiceAreaRef.current = new google.maps.Polygon({
        map,
        paths: gbpServiceAreaRing,
        fillColor: "#137333",
        fillOpacity: 0.05,
        strokeColor: "#137333",
        strokeOpacity: 0.7,
        strokeWeight: 2,
        clickable: false,
        zIndex: 35,
      });
      return;
    }

    if (!gridPoints?.length || !centerRef.current) return;

    const bounds = serviceAreaFromGrid(centerRef.current, gridPoints);
    if (!bounds) return;

    gridServiceAreaRef.current = new google.maps.Polygon({
      map,
      paths: bounds.ring,
      fillColor: "#1a73e8",
      fillOpacity: 0.06,
      strokeColor: "#1a73e8",
      strokeOpacity: 0.55,
      strokeWeight: 2,
      clickable: false,
      zIndex: 40,
    });
  }, [ready, layers.showServiceArea, gridPoints, gbpServiceAreaRing]);

  useEffect(() => {
    territoryPolygonsRef.current.forEach((polygon) => polygon.setMap(null));
    territoryPolygonsRef.current = [];

    if (!ready || !mapInstance.current || !layers.showCompetitorZones) return;
    if (!HEATMAP_FLAGS.competitorTerritories || competitorTerritories.length === 0) return;

    const google = window.google;
    if (!google) return;

    for (const territory of competitorTerritories) {
      const polygon = new google.maps.Polygon({
        map: mapInstance.current!,
        paths: territory.ring,
        fillColor: territory.color,
        fillOpacity: 0.14,
        strokeColor: territory.color,
        strokeOpacity: 0.65,
        strokeWeight: 1.5,
        clickable: false,
        zIndex: 45,
      });
      territoryPolygonsRef.current.push(polygon);
    }
  }, [ready, layers.showCompetitorZones, competitorTerritories]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;

    competitorMarkersRef.current.forEach((m) => m.setMap(null));
    competitorMarkersRef.current = [];

    if (!layers.showCompetitors || competitors.length === 0) return;

    let cancelled = false;

    async function placeCompetitors() {
      const map = mapInstance.current!;
      const g = await loadGoogleMaps();
      if (cancelled) return;
      const top3 = competitors.slice(0, 3);

      for (let i = 0; i < top3.length; i++) {
        if (cancelled) return;
        const comp = top3[i];
        if (!comp.placeId) continue;

        const position =
          storedPlaceGeometry(comp) ??
          (await getPlaceGeometry(comp.placeId, map));
        if (cancelled || !position) continue;

        const packPos = activeKeyword
          ? competitorMapRank(comp.mapPositions, activeKeyword, i)
          : i + 1;
        const label = String(packPos);

        const marker = new g.maps.Marker({
          position,
          map,
          title: comp.name,
          label: {
            text: label,
            color: "#ffffff",
            fontWeight: "bold",
            fontSize: "11px",
          },
          icon: createCompetitorMarkerIcon(g),
          zIndex: 500 + i,
        });
        competitorMarkersRef.current.push(marker);
      }
    }

    void placeCompetitors();
    return () => {
      cancelled = true;
    };
  }, [competitors, ready, layers.showCompetitors, activeKeyword]);

  if (error) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#e8eaed] p-6 text-center lg:min-h-0">
        <div>
          <p className="text-sm font-medium text-[#3c4043]">Map unavailable</p>
          <p className="mt-1 text-xs text-[#5f6368]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className={`relative h-full min-h-[240px] w-full flex-1 bg-[#e8eaed] transition-opacity duration-150 ${
        mapVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <MapLayerControls layers={layers} onChange={setLayers} />
      <div ref={mapRef} className="absolute inset-0" />
      {HEATMAP_FLAGS.insightPanel && visibilitySummary && (
        <CoverageBadge summary={visibilitySummary} />
      )}
      {HEATMAP_FLAGS.gridDiff && clientId && activeKeyword && onDiffChange && (
        <GridDiffControls
          clientId={clientId}
          keyword={activeKeyword}
          enabled={HEATMAP_FLAGS.gridDiff}
          onDiffChange={onDiffChange}
        />
      )}
      {HEATMAP_FLAGS.insightPanel && visibilitySummary && (
        <VisibilityInsightPanel
          summary={visibilitySummary}
          currency={currency}
          selectedZoneId={selectedZoneId}
          onZoneSelect={onZoneSelect}
          onOpenPlan={onOpenPlan}
          topCompetitorThreat={topCompetitorThreat}
          competitorThreats={competitorThreats}
        />
      )}
      <CellDetailModal
        cell={selectedCell}
        keyword={activeKeyword ?? keywordRank?.keyword ?? ""}
        clientRating={keywordRank?.clientRating}
        clientReviewCount={keywordRank?.clientReviewCount}
        leaderDelta={selectedLeaderDelta}
        clientId={clientId}
        open={selectedCell != null}
        onClose={() => setSelectedCell(null)}
      />
      <MapGuidePanel
        keywordRank={keywordRank}
        heatmapOn={layers.showHeatmap}
        gridLoading={gridLoading}
        hasGridData={Boolean(gridPoints?.length)}
        enabledRadii={layers.enabledRadii}
      />
    </div>
  );
}
