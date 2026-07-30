import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { buildProfileGuideFlyerHtml } from "@/lib/profile-guide/flyer";
import { profileGuidePublicUrl } from "@/lib/profile-guide/slug";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
import { PROFILE_GUIDE_FLYER_TEMPLATES } from "@/lib/profile-guide/theme";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const templateParam = url.searchParams.get("template") ?? "professional";
  const template = PROFILE_GUIDE_FLYER_TEMPLATES.includes(
    templateParam as (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number]
  )
    ? (templateParam as (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number])
    : "professional";

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const publicUrl = profileGuidePublicUrl(guide.guide.slug, origin);

  try {
    const html = await buildProfileGuideFlyerHtml({
      businessName: guide.guide.display_name,
      tagline: guide.guide.tagline,
      primaryColor: guide.guide.primary_color,
      backgroundColor: guide.guide.background_color,
      publicUrl,
      phone: business.phone,
      template,
    });

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="profile-guide-flyer-${template}.html"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate flyer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
