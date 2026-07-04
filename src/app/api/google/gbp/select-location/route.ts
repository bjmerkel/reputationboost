import { NextResponse } from "next/server";
import { getBusinessRecord, saveGbpLocation } from "@/audit/businesses";
import { validateGbpLocationSelection } from "@/lib/google/gbp-onboarding-match";
import { fetchPlaceDetails } from "@/lib/google/place-details";
import { getGbpAccessTokenForRecord } from "@/lib/google/token-store";
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
      address?: string;
      parentChainId?: string;
      chainDisplayName?: string;
    };

    if (!body.businessId || !body.accountId || !body.locationId) {
      return NextResponse.json({ error: "Missing location selection" }, { status: 400 });
    }

    const business = await getBusinessRecord(user.id, body.businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const accessToken = await getGbpAccessTokenForRecord(business);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Business Profile is not connected. Reconnect and try again." },
        { status: 400 }
      );
    }

    const businessAddress = business.location
      ? [
          business.location.address,
          business.location.city,
          business.location.state,
          business.location.zip,
        ]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const validation = await validateGbpLocationSelection(
      accessToken,
      {
        name: `locations/${body.locationId}`,
        locationId: body.locationId,
        accountId: body.accountId,
        title: body.title ?? "Selected location",
        address: body.address ?? businessAddress ?? "",
        phone: body.phone ?? "",
        website: body.website ?? "",
        placeId: body.placeId,
        primaryCategory: body.industry ?? business.industry,
        parentChainId: body.parentChainId,
        chainDisplayName: body.chainDisplayName,
      },
      {
        name: business.name,
        placeId: business.gbp_place_id,
        address: businessAddress,
      }
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.warning ?? "Selected location does not match your business." },
        { status: 400 }
      );
    }

    let mapsUrl: string | undefined;
    const placeId = body.placeId ?? business.gbp_place_id ?? undefined;
    if (placeId) {
      try {
        const place = await fetchPlaceDetails(placeId);
        mapsUrl = place.mapsUrl || undefined;
      } catch {
        // Location can still be saved without a Maps URL
      }
    }

    await saveGbpLocation(user.id, body.businessId, {
      accountId: body.accountId,
      locationId: body.locationId,
      placeId,
      mapsUrl,
      name: body.title,
      phone: body.phone,
      website: body.website,
      industry: body.industry,
    });

    return NextResponse.json({
      success: true,
      warning: validation.warning,
      matchScore: validation.matchScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
