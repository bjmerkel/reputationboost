import { NextResponse } from "next/server";
import { saveGbpLocation } from "@/audit/businesses";
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

    await saveGbpLocation(user.id, body.businessId, {
      accountId: body.accountId,
      locationId: body.locationId,
      placeId: body.placeId,
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
