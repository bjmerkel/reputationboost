import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { listCustomerEvents, listRecentSmsMessages } from "@/lib/customers/events-storage";
import { getOutreachStats } from "@/lib/review-requests/attribution";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const [events, sms, stats] = await Promise.all([
      listCustomerEvents(user.id, business.businessId, 50),
      listRecentSmsMessages(user.id, business.businessId, 30),
      getOutreachStats(user.id, business.businessId),
    ]);

    return NextResponse.json({ events, sms, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load outreach activity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
