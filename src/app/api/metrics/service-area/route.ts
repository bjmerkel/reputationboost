import { NextResponse } from "next/server";
import { loadBusinessConfig, saveGbpServiceArea } from "@/audit/businesses";
import type { GbpPersistedServiceArea } from "@/audit/types";
import { serviceAreaFromGbpPlaces } from "@/audit/geo/service-area";
import { getUser } from "@/lib/supabase/server";
import { isGoogleBusinessApiConfigured } from "@/lib/google/business-config";
import { fetchGbpServiceAreaData } from "@/lib/google/gbp-location";
import { resolveServiceAreaPlace } from "@/lib/google/places";

const EMPTY = { source: null, ring: [], places: [] as const };

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  let client;
  try {
    client = await loadBusinessConfig(user.id, clientId);
  } catch {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (!isGoogleBusinessApiConfigured()) {
    return NextResponse.json(EMPTY);
  }

  try {
    let serviceArea: GbpPersistedServiceArea =
      client.gbpServiceArea ?? {
        version: 1,
        businessType: null,
        places: [],
        businessLatLng: null,
      };
    let places = serviceArea.places;
    if (!places.length && client.gbpConnection) {
      const live = await fetchGbpServiceAreaData(client.gbpConnection);
      places = live.places;
      serviceArea = {
        ...serviceArea,
        places,
        businessLatLng: live.businessLatLng,
      };
    }
    if (!places.length) {
      return NextResponse.json(EMPTY);
    }

    const geocoded = [];
    let coordinatesAdded = false;
    const persistedPlaces: GbpPersistedServiceArea["places"] = [];
    for (const place of places) {
      const storedPoint =
        Number.isFinite(place.lat) && Number.isFinite(place.lng)
          ? { lat: place.lat!, lng: place.lng! }
          : null;
      const point =
        storedPoint ??
        (await resolveServiceAreaPlace(place.placeId, place.placeName));
      if (!storedPoint && point) coordinatesAdded = true;
      persistedPlaces.push({
        ...place,
        ...(point ? { lat: point.lat, lng: point.lng } : {}),
      });
      if (!point) continue;

      geocoded.push({
        placeId: place.placeId,
        placeName: place.placeName,
        lat: point.lat,
        lng: point.lng,
      });
    }

    if (
      client.businessId &&
      (coordinatesAdded || client.gbpServiceArea?.places.length !== persistedPlaces.length)
    ) {
      await saveGbpServiceArea(user.id, client.businessId, {
        ...serviceArea,
        places: persistedPlaces,
      }).catch(() => undefined);
    }

    const bounds = serviceAreaFromGbpPlaces(geocoded);
    if (!bounds) {
      return NextResponse.json(EMPTY);
    }

    return NextResponse.json({
      source: "gbp",
      ring: bounds.ring,
      radiusMiles: bounds.radiusMiles,
      places: geocoded,
    });
  } catch {
    // Optional map overlay — never fail the audit page
    return NextResponse.json(EMPTY);
  }
}
