import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  acknowledgeGbpEventForUser,
  listActiveGbpEventsForUser,
} from "@/audit/storage-gbp-events";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");

  if (!clientId) {
    const business = await getPrimaryBusiness(user.id);
    clientId = business?.id ?? null;
  }

  if (!clientId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const businessId = await getBusinessIdForSlug(user.id, clientId);
  if (!businessId) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    const events = await listActiveGbpEventsForUser(user.id, businessId);
    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load alerts" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { eventId?: string };
  try {
    body = (await request.json()) as { eventId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  try {
    const event = await acknowledgeGbpEventForUser(user.id, body.eventId);
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to acknowledge alert" },
      { status: 500 }
    );
  }
}
