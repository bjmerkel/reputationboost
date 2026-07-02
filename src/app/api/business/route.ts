import { NextResponse } from "next/server";
import { createBusiness } from "@/audit/businesses";
import { getUser } from "@/lib/supabase/server";

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
    };

    if (!body.name?.trim() || !body.industry?.trim()) {
      return NextResponse.json({ error: "Business name and industry are required" }, { status: 400 });
    }

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
    });

    return NextResponse.json({ business });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create business";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
