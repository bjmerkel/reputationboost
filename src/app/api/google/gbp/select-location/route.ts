import { NextResponse } from "next/server";
import { saveGbpLocation } from "@/audit/businesses";
import { fetchPlaceDetails } from "@/lib/google/place-details";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      businessId: string;
      accountId: string;
      locationId: string;
      placeId?: string;
      title?: string;
      phone?: string;
      website?: string;
      industry?: string;
    };

    if (!body.businessId || !body.accountId || !body.locationId) {
      return NextResponse.json({ error: "Missing location selection" }, { status: 400 });
    }

    let mapsUrl: string | undefined;
    if (body.placeId) {
      try {
        const place = await fetchPlaceDetails(body.placeId);
        mapsUrl = place.mapsUrl || undefined;
      } catch {
        // Location can still be saved without a Maps URL
      }
    }

    await saveGbpLocation(user.id, body.businessId, {
      accountId: body.accountId,
      locationId: body.locationId,
      placeId: body.placeId,
      mapsUrl,
      name: body.title,
      phone: body.phone,
      website: body.website,
      industry: body.industry,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
