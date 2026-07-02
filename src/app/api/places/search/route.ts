import { NextResponse } from "next/server";
import { demoClient } from "@/audit/clients";
import { getUser } from "@/lib/supabase/server";
import {
  extractCompetitors,
  findBusinessRank,
  resolveBusinessLocation,
} from "@/lib/google/local-rankings";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { milesToMeters, nearbySearch, type PlaceResult } from "@/lib/google/places";

export interface PlacesSearchResponse {
  keyword: string;
  radiusMiles: number;
  location: { lat: number; lng: number };
  businesses: PlaceResult[];
  businessRank: number | null;
  competitors: PlaceResult[];
}

/**
 * Proxies Google Places Nearby Search for keyword + location + radius.
 * Used by KeywordTracker-style flows; audit engine calls the lib directly.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleMapsConfigured()) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");
  const businessName = searchParams.get("business") ?? demoClient.name;
  const placeId = searchParams.get("placeId") ?? demoClient.gbpPlaceId;
  const address = searchParams.get("address");
  const radiusMilesParam = searchParams.get("radiusMiles");
  const radiusRaw = searchParams.get("radius");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  let radiusMeters: number;
  if (radiusMilesParam) {
    radiusMeters = milesToMeters(Number(radiusMilesParam));
  } else if (radiusRaw) {
    const r = Number(radiusRaw);
    // Legacy clients pass meters (e.g. 1609); small values are treated as miles
    radiusMeters = r > 100 ? r : milesToMeters(r);
  } else {
    radiusMeters = milesToMeters(1);
  }

  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return NextResponse.json({ error: "radius must be a positive number" }, { status: 400 });
  }

  const radiusMiles = radiusMeters / 1609.34;

  let location: { lat: number; lng: number };
  if (lat && lng) {
    location = { lat: Number(lat), lng: Number(lng) };
  } else if (address) {
    const client = { ...demoClient, location: { ...demoClient.location, address } };
    location = await resolveBusinessLocation(client);
  } else {
    location = await resolveBusinessLocation(demoClient);
  }

  const matchOptions = {
    businessName,
    placeId: placeId ?? undefined,
    businessAddress: address ?? undefined,
  };

  const businesses = await nearbySearch(keyword, location, radiusMeters);
  const businessRank = findBusinessRank(businesses, matchOptions);
  const competitors = extractCompetitors(businesses, matchOptions, 3);

  const payload: PlacesSearchResponse = {
    keyword,
    radiusMiles: Math.round(radiusMiles * 10) / 10,
    location,
    businesses,
    businessRank,
    competitors,
  };

  return NextResponse.json(payload);
}
