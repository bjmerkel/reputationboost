import { NextResponse } from "next/server";
import { getBusinessRecord, getPrimaryBusiness } from "@/audit/businesses";
import {
  acknowledgeGbpEventForUser,
  listActiveGbpEventsForUser,
} from "@/audit/storage-gbp-events";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { scanBusinessModeration } from "@/lib/google/gbp-moderation-scan";
import { isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

async function resolveBusinessId(userId: string, clientId: string | null): Promise<string | null> {
  let resolved = clientId;
  if (!resolved) {
    const business = await getPrimaryBusiness(userId);
    resolved = business?.id ?? null;
  }
  if (!resolved) return null;
  return getBusinessIdForSlug(userId, resolved);
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const businessId = await resolveBusinessId(user.id, clientId);

  if (!businessId) {
    return NextResponse.json(
      { error: clientId ? "Business not found" : "No business configured" },
      { status: clientId ? 404 : 400 }
    );
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

/** Refresh alerts from live Google state, then return the active feed. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Alert refresh is unavailable right now" },
      { status: 503 }
    );
  }

  let body: { clientId?: string; action?: string } = {};
  try {
    body = (await request.json()) as { clientId?: string; action?: string };
  } catch {
    body = {};
  }

  if (body.action && body.action !== "refresh") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const businessId = await resolveBusinessId(user.id, body.clientId ?? null);
  if (!businessId) {
    return NextResponse.json(
      { error: body.clientId ? "Business not found" : "No business configured" },
      { status: body.clientId ? 404 : 400 }
    );
  }

  const record = await getBusinessRecord(user.id, businessId);
  if (!record) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  try {
    const scan = await scanBusinessModeration(record);
    const events = await listActiveGbpEventsForUser(user.id, businessId);
    return NextResponse.json({
      events,
      count: events.length,
      refreshed: true,
      eventsRecorded: scan.eventsRecorded,
      eventsCleared: scan.eventsCleared,
      errors: scan.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh alerts" },
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
