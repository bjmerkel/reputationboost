"use client";

import { useEffect, useRef, useState } from "react";
import type { CompetitorProfile, GeoGridPoint, KeywordRankSnapshot } from "@/audit/types";
import MapLayerControls, {
  createDefaultMapLayers,
  type MapLayerState,
} from "@/components/platform/MapLayerControls";
import { getPlaceGeometry } from "@/lib/google/place-geometry";
import { loadGoogleMaps } from "@/lib/google/maps-loader";
import {
  createBusinessPinIcon,
  createCompetitorMarkerIcon,
  createGoogleMapOptions,
} from "@/lib/google/map-marker-icons";

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

export function rankColor(rank: number | null): string {
  if (rank === null) return "#9aa0a6";
  if (rank <= 3) return "#34a853";
  if (rank <= 10) return "#fbbc04";
  return "#ea4335";
}

interface RankingMapProps {
  lat: number;
  lng: number;
  address: string;
  businessName: string;
  keywordRank?: KeywordRankSnapshot;
  competitors?: CompetitorProfile[];
  activeKeyword?: string;
  /** Skip authenticated /api/places/grid fetches (marketing preview). */
  disableGridFetch?: boolean;
}

export default function RankingMap({
  lat,
  lng,
  address,
  businessName,
  keywordRank,
  competitors = [],
  activeKeyword,
  disableGridFetch = false,
}: RankingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const businessMarkerRef = useRef<google.maps.Marker | null>(null);
  const competitorMarkersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const gridCirclesRef = useRef<google.maps.Circle[]>([]);
  const centerRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [layers, setLayers] = useState<MapLayerState>(createDefaultMapLayers);
  const [gridPoints, setGridPoints] = useState<GeoGridPoint[] | undefined>(
    keywordRank?.geoGrid
  );
  const [gridLoading, setGridLoading] = useState(false);

  useEffect(() => {
    setGridPoints(keywordRank?.geoGrid);
  }, [keywordRank?.geoGrid, keywordRank?.keyword]);

  useEffect(() => {
    if (!layers.showHeatmap || !activeKeyword || !ready || disableGridFetch) return;
    if (gridPoints?.length) return;

    let cancelled = false;

    async function loadGrid() {
      setGridLoading(true);
      try {
        const res = await fetch(
          `/api/places/grid?keyword=${encodeURIComponent(activeKeyword!)}`
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
  }, [layers.showHeatmap, activeKeyword, ready, gridPoints?.length, disableGridFetch]);

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

    if (!layers.showHeatmap || !gridPoints?.length) return;

    const google = window.google;
    if (!google) return;

    for (const point of gridPoints) {
      const color = rankColor(point.rank);
      const circle = new google.maps.Circle({
        map: mapInstance.current,
        center: { lat: point.lat, lng: point.lng },
        radius: 140,
        fillColor: color,
        fillOpacity: 0.55,
        strokeColor: color,
        strokeOpacity: 0.85,
        strokeWeight: 1,
        clickable: false,
      });
      gridCirclesRef.current.push(circle);
    }
  }, [gridPoints, layers.showHeatmap, ready]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;

    competitorMarkersRef.current.forEach((m) => m.setMap(null));
    competitorMarkersRef.current = [];

    if (!layers.showCompetitors || competitors.length === 0) return;

    let cancelled = false;

    async function placeCompetitors() {
      const map = mapInstance.current!;
      const g = window.google;
      if (!g) return;
      const top3 = competitors.slice(0, 3);

      for (let i = 0; i < top3.length; i++) {
        if (cancelled) return;
        const comp = top3[i];
        if (!comp.placeId) continue;

        const position = await getPlaceGeometry(comp.placeId, map);
        if (cancelled || !position) continue;

        const packPos = activeKeyword
          ? comp.mapPositions[activeKeyword]
          : undefined;
        const label =
          typeof packPos === "number" && packPos <= 3
            ? String(packPos)
            : String(i + 1);

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
      {keywordRank && (
        <div className="absolute bottom-4 right-4 max-w-[220px] rounded-lg border border-[#dadce0]/80 bg-white px-3 py-2.5 text-xs shadow-[0_2px_6px_rgba(60,64,67,0.15)]">
          <p className="font-medium text-[#202124]">{keywordRank.keyword}</p>
          <p className="mt-0.5 text-[#5f6368]">
            {keywordRank.inLocalPack
              ? `Rank #${keywordRank.localPackPosition} in Local 3-Pack`
              : "Not in Local 3-Pack"}
          </p>
          {gridLoading && layers.showHeatmap && (
            <p className="mt-1 text-[#1a73e8]">Loading heatmap…</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {keywordRank.geoRanks.map((g) => (
              <span
                key={g.distanceMiles}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{
                  backgroundColor: rankColor(g.rank),
                  opacity: layers.enabledRadii.has(g.distanceMiles) ? 1 : 0.4,
                }}
              >
                {g.distanceMiles}mi: {g.rank ?? "—"}
              </span>
            ))}
          </div>
          {layers.showHeatmap && gridPoints && gridPoints.length > 0 && (
            <div className="mt-2 border-t border-[#dadce0] pt-2">
              <p className="text-[10px] font-medium text-[#5f6368]">Geo grid legend</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {[
                  { label: "Top 3", color: rankColor(1) },
                  { label: "4–10", color: rankColor(7) },
                  { label: "11+", color: rankColor(15) },
                  { label: "N/F", color: rankColor(null) },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1 text-[10px] text-[#5f6368]"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
