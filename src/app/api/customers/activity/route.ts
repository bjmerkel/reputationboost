import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  listCustomerEvents,
  listEventFilterOptions,
  listRecentSmsMessages,
} from "@/lib/customers/events-storage";
import { getOutreachStats } from "@/lib/review-requests/attribution";
import { getUser } from "@/lib/supabase/server";

function readInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBool(value: string | null): boolean | undefined {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const url = new URL(request.url);
  const eventsLimit = readInt(url.searchParams.get("eventsLimit"), 25);
  const eventsOffset = readInt(url.searchParams.get("eventsOffset"), 0);
  const smsLimit = readInt(url.searchParams.get("smsLimit"), 20);
  const smsOffset = readInt(url.searchParams.get("smsOffset"), 0);
  const eventType = url.searchParams.get("eventType")?.trim() || undefined;
  const source = url.searchParams.get("source")?.trim() || undefined;
  const reviewRequestSent = readBool(url.searchParams.get("sentOnly"));
  const optedOutOnly = url.searchParams.get("optedOutOnly") === "1";
  const smsStatus = url.searchParams.get("smsStatus")?.trim() || undefined;
  const includeFilters = url.searchParams.get("includeFilters") === "1";

  try {
    const [eventResult, smsResult, stats, filters] = await Promise.all([
      listCustomerEvents(user.id, business.businessId, {
        limit: eventsLimit,
        offset: eventsOffset,
        eventType,
        source,
        reviewRequestSent,
        optedOutOnly,
      }),
      listRecentSmsMessages(user.id, business.businessId, {
        limit: smsLimit,
        offset: smsOffset,
        status: smsStatus,
      }),
      getOutreachStats(user.id, business.businessId),
      includeFilters
        ? listEventFilterOptions(user.id, business.businessId)
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      events: eventResult.events,
      eventsTotal: eventResult.total,
      eventsLimit,
      eventsOffset,
      sms: smsResult.sms,
      smsTotal: smsResult.total,
      smsLimit,
      smsOffset,
      stats,
      filters,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load outreach activity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
