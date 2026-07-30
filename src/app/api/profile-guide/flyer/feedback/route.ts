import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import {
  getProfileGuideFlyerStudio,
  saveProfileGuideFlyerFeedback,
  serializeFlyerStudioForClient,
} from "@/lib/profile-guide/flyer/studio-db";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
import { getUser } from "@/lib/supabase/server";

function parseRating(value: unknown): -1 | 1 | null {
  if (value === 1 || value === -1) return value;
  return null;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const guide = await getProfileGuideByBusinessId(user.id, business.businessId);
  if (!guide) {
    return NextResponse.json({ error: "Profile Guide not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rating = parseRating(record.rating);
  if (!rating) {
    return NextResponse.json({ error: "rating must be 1 or -1" }, { status: 400 });
  }

  const existing = await getProfileGuideFlyerStudio(user.id, guide.guide.id);
  if (!existing?.preview) {
    return NextResponse.json({ error: "Generate a flyer before leaving feedback" }, { status: 400 });
  }

  const historyId =
    typeof record.historyId === "string" ? record.historyId : existing.selectedHistoryId;

  try {
    const updated = await saveProfileGuideFlyerFeedback({
      userId: user.id,
      guideId: guide.guide.id,
      businessId: business.businessId,
      rating,
      historyId,
      archetype: existing.archetype,
      format: existing.format,
      promptVersion: existing.promptVersion,
    });

    return NextResponse.json({
      ok: true,
      flyerStudio: serializeFlyerStudioForClient(updated),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save flyer feedback";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
