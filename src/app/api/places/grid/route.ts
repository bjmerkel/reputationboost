import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getUser } from "@/lib/supabase/server";
import { isGoogleMapsConfigured } from "@/lib/google/config";
import { buildDemoGeoGrid, collectKeywordGeoGrid } from "@/lib/google/geo-grid";
import { gridProfileForCollection } from "@/lib/feature-flags";
import {
  resolveBusinessLocation,
  type BusinessMatchOptions,
} from "@/lib/google/local-rankings";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");
  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }

  const location = await resolveBusinessLocation(business);
  const matchOptions: BusinessMatchOptions = {
    businessName: business.name,
    placeId: business.gbpPlaceId,
    businessAddress: `${business.location.address}, ${business.location.city}, ${business.location.state} ${business.location.zip}`,
  };

  if (!isGoogleMapsConfigured()) {
    const geoGrid = buildDemoGeoGrid(location, 4, gridProfileForCollection("api", business.heatmapProfile));
    return NextResponse.json({ keyword, geoGrid, source: "demo" });
  }

  try {
    const geoGrid = await collectKeywordGeoGrid(keyword, location, matchOptions, {
      profile: gridProfileForCollection("api", business.heatmapProfile),
      includeLocalPack: true,
    });
    return NextResponse.json({ keyword, geoGrid, source: "api" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Grid collection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
