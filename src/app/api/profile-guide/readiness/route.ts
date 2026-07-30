import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { buildProfileGuideReadiness } from "@/lib/profile-guide/readiness";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
import { getProfileGuideAnalyticsAdmin } from "@/lib/profile-guide/storage-admin";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const guide = await getProfileGuideByBusinessId(user.id, business.businessId);
    if (!guide) {
      return NextResponse.json({ readiness: buildProfileGuideReadiness({ guide: null }) });
    }

    const analytics = await getProfileGuideAnalyticsAdmin(guide.guide.id, 30);
    return NextResponse.json({
      readiness: buildProfileGuideReadiness({
        guide,
        views30d: analytics.totalViews,
        attributedReviews30d: analytics.attributedReviews,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Profile Guide readiness";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
