import { NextResponse } from "next/server";
import { geocodeAddress, geocodePlaceId } from "@/lib/google/places";

/** Geocode a service-area business when Places returns no lat/lng. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      placeId?: string;
      name?: string;
      formattedAddress?: string;
      city?: string;
      state?: string;
    };

    const placeId = body.placeId?.trim();
    if (placeId) {
      const byId = await geocodePlaceId(placeId);
      if (byId) return NextResponse.json(byId);
    }

    const candidates = [
      body.formattedAddress,
      [body.city, body.state].filter(Boolean).join(", "),
      body.name,
    ]
      .map((value) => value?.trim())
      .filter(Boolean);

    for (const query of candidates) {
      try {
        const location = await geocodeAddress(query!);
        return NextResponse.json(location);
      } catch {
        // Try the next candidate query.
      }
    }

    return NextResponse.json({ error: "Could not resolve location" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
