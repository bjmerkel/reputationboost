"use client";

import { useEffect, useRef, useState } from "react";
import type { KeywordRankSnapshot } from "@/audit/types";
import { loadGoogleMapsCore } from "@/lib/google/maps-loader";

function milesToMeters(miles: number): number {
  return Math.round(miles * 1609.34);
}

function rankColor(rank: number | null): string {
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
}

export default function RankingMap({
  lat,
  lng,
  address,
  businessName,
  keywordRank,
}: RankingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const centerRef = useRef<google.maps.LatLngLiteral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      try {
        const google = await loadGoogleMapsCore();
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
          mapInstance.current = new google.maps.Map(mapRef.current, {
            center,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: "greedy",
          });

          markerRef.current = new google.maps.Marker({
            position: center,
            map: mapInstance.current,
            title: businessName,
          });
        } else {
          mapInstance.current.setCenter(center);
          markerRef.current?.setPosition(center);
        }

        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Map failed to load");
        }
      }
    }

    void initMap();
    return () => {
      cancelled = true;
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
      const color = rankColor(point.rank);
      const circle = new google.maps.Circle({
        map: mapInstance.current,
        center: centerRef.current,
        radius: milesToMeters(point.distanceMiles),
        fillColor: color,
        fillOpacity: 0.12,
        strokeColor: color,
        strokeOpacity: 0.7,
        strokeWeight: 2,
      });
      circlesRef.current.push(circle);
    }
  }, [keywordRank, ready]);

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
    <div className="relative h-full min-h-[240px] w-full lg:min-h-0">
      <div ref={mapRef} className="absolute inset-0" />
      {keywordRank && (
        <div className="absolute bottom-4 left-4 rounded-lg bg-white/95 px-3 py-2 text-xs shadow-md">
          <p className="font-medium text-[#202124]">{keywordRank.keyword}</p>
          <p className="mt-0.5 text-[#5f6368]">
            {keywordRank.inLocalPack
              ? `Rank #${keywordRank.localPackPosition} in Local 3-Pack`
              : "Not in Local 3-Pack"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywordRank.geoRanks.map((g) => (
              <span
                key={g.distanceMiles}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: rankColor(g.rank) }}
              >
                {g.distanceMiles}mi: {g.rank ?? "—"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
