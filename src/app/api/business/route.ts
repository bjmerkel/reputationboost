import { NextResponse } from "next/server";
import { createBusiness, getPrimaryBusiness, saveAvgCustomerValue } from "@/audit/businesses";
import { recomputeAttributionsForBusiness } from "@/audit/attribution";
import { getUser } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      businessId?: string;
      avgCustomerValue?: number | null;
    };

    const business = await getPrimaryBusiness(user.id);
    const businessId = body.businessId ?? business?.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No business configured" }, { status: 400 });
    }

    const raw = body.avgCustomerValue;
    const avgCustomerValue =
      raw === null || raw === undefined || Number.isNaN(Number(raw)) ? null : Number(raw);

    if (avgCustomerValue !== null && avgCustomerValue < 0) {
      return NextResponse.json({ error: "Customer value must be positive" }, { status: 400 });
    }

    const updated = await saveAvgCustomerValue(user.id, businessId, avgCustomerValue);

    void recomputeAttributionsForBusiness(businessId).catch((error) => {
      console.warn("[business] attribution recompute after ROI update failed:", error);
    });

    return NextResponse.json({ business: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update business";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name: string;
      industry: string;
      address: string;
      city: string;
      state: string;
      zip: string;
      keywords: string[];
      website?: string;
      phone?: string;
      lat?: number;
      lng?: number;
      placeId?: string;
      mapsUrl?: string;
      avgCustomerValue?: number | null;
    };

    if (!body.name?.trim() || !body.industry?.trim()) {
      return NextResponse.json({ error: "Business name and industry are required" }, { status: 400 });
    }

    const mapsUrl = body.mapsUrl?.trim();
    const placeId = body.placeId?.trim();

    const business = await createBusiness(user.id, {
      name: body.name.trim(),
      industry: body.industry.trim(),
      location: {
        address: body.address?.trim() ?? "",
        city: body.city?.trim() ?? "",
        state: body.state?.trim() ?? "",
        zip: body.zip?.trim() ?? "",
        lat: body.lat ?? 0,
        lng: body.lng ?? 0,
      },
      keywords: body.keywords?.filter(Boolean) ?? [],
      website: body.website?.trim(),
      phone: body.phone?.trim(),
      gbpPlaceId: placeId,
      gbpMapsUrl: mapsUrl,
      avgCustomerValue:
        body.avgCustomerValue != null && !Number.isNaN(Number(body.avgCustomerValue))
          ? Number(body.avgCustomerValue)
          : null,
    });

    return NextResponse.json({ business });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create business";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
