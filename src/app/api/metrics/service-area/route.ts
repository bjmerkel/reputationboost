import { NextResponse } from "next/server";
import { loadBusinessConfig } from "@/audit/businesses";
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
    let places = client.gbpServiceArea?.places ?? [];
    if (!places.length && client.gbpConnection) {
      const live = await fetchGbpServiceAreaData(client.gbpConnection);
      places = live.places;
    }
    if (!places.length) {
      return NextResponse.json(EMPTY);
    }

    const geocoded = [];
    for (const place of places) {
      const point = await resolveServiceAreaPlace(place.placeId, place.placeName);
      if (!point) continue;

      geocoded.push({
        placeId: place.placeId,
        placeName: place.placeName,
        lat: point.lat,
        lng: point.lng,
      });
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
