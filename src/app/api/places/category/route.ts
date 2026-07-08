import { NextResponse } from "next/server";
import { fetchPlaceCategoryLabel } from "@/lib/google/place-category";
import { isGenericCategoryLabel } from "@/lib/google/place-details";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { placeId?: string };
    const placeId = body.placeId?.trim();
    if (!placeId) {
      return NextResponse.json({ error: "placeId is required" }, { status: 400 });
    }

    const industry = await fetchPlaceCategoryLabel(placeId);
    if (!industry) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    return NextResponse.json({ industry, generic: isGenericCategoryLabel(industry) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve category";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
