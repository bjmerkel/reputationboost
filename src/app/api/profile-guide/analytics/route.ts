import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { summarizeProfileGuideAnalytics } from "@/lib/profile-guide/analytics";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
import { getProfileGuideAnalyticsAdmin } from "@/lib/profile-guide/storage-admin";
import type { ProfileGuideAnalyticsPeriod } from "@/lib/profile-guide/types";
import { getUser } from "@/lib/supabase/server";

function parsePeriod(value: string | null): ProfileGuideAnalyticsPeriod {
  if (value === "7" || value === "30" || value === "90") {
    return Number(value) as ProfileGuideAnalyticsPeriod;
  }
  return 30;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const url = new URL(request.url);
  const periodDays = parsePeriod(url.searchParams.get("period"));

  try {
    const guide = await getProfileGuideByBusinessId(user.id, business.businessId);
    if (!guide) {
      return NextResponse.json({
        analytics: summarizeProfileGuideAnalytics(periodDays, {
          totalViews: 0,
          totalClicks: 0,
          linkClicks: [],
          viewsByDay: [],
        }),
      });
    }

    const raw = await getProfileGuideAnalyticsAdmin(guide.guide.id, periodDays);
    return NextResponse.json({
      analytics: summarizeProfileGuideAnalytics(periodDays, raw),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
