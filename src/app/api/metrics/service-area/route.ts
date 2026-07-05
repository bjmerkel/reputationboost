import { NextResponse } from "next/server";
import { loadBusinessConfig } from "@/audit/businesses";
import { serviceAreaFromGbpPlaces } from "@/audit/geo/service-area";
import { getUser } from "@/lib/supabase/server";
import { isGoogleBusinessApiConfigured } from "@/lib/google/business-config";
import { getGbpLocationProfile } from "@/lib/google/gbp-location";
import { geocodeAddress } from "@/lib/google/places";

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

  if (!client.gbpConnection || !isGoogleBusinessApiConfigured()) {
    return NextResponse.json({ source: null, ring: [], places: [] });
  }

  try {
    const profile = await getGbpLocationProfile(client.gbpConnection);
    if (!profile.serviceAreaPlaces.length) {
      return NextResponse.json({ source: null, ring: [], places: [] });
    }

    const geocoded = [];
    for (const place of profile.serviceAreaPlaces) {
      try {
        const point = await geocodeAddress(place.placeName);
        geocoded.push({
          placeId: place.placeId,
          placeName: place.placeName,
          lat: point.lat,
          lng: point.lng,
        });
      } catch {
        // Skip places that fail geocoding
      }
    }

    const bounds = serviceAreaFromGbpPlaces(geocoded);
    if (!bounds) {
      return NextResponse.json({ source: null, ring: [], places: [] });
    }

    return NextResponse.json({
      source: "gbp",
      ring: bounds.ring,
      radiusMiles: bounds.radiusMiles,
      places: geocoded,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load service area";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
