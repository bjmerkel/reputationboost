import { NextResponse } from "next/server";
import { getBusinessRecord } from "@/audit/businesses";
import { listAllGbpLocations } from "@/lib/google/gbp-accounts";
import { rankGbpLocationsForBusiness } from "@/lib/google/gbp-onboarding-match";
import { getGbpAccessTokenForRecord } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  try {
    const business = await getBusinessRecord(user.id, businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const accessToken = await getGbpAccessTokenForRecord(business);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Business Profile is not connected." },
        { status: 400 }
      );
    }

    const locations = await listAllGbpLocations(accessToken);
    const address = business.location
      ? [
          business.location.address,
          business.location.city,
          business.location.state,
          business.location.zip,
        ]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const ranked = await rankGbpLocationsForBusiness(accessToken, locations, {
      name: business.name,
      placeId: business.gbp_place_id,
      address,
    });

    return NextResponse.json({
      locations: ranked,
      currentLocationId: business.gbp_location_id,
      totalCount: ranked.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
