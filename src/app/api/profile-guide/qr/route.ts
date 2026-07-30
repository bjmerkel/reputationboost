import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getActiveBusiness } from "@/lib/business/active-business";
import { profileGuidePublicUrl } from "@/lib/profile-guide/slug";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
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
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const target = `${profileGuidePublicUrl(guide.guide.slug, origin)}?src=qr`;

  try {
    const png = await QRCode.toBuffer(target, {
      type: "png",
      width: 512,
      margin: 2,
      color: {
        dark: guide.guide.primary_color || "#1a73e8",
        light: "#ffffff",
      },
    });

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="profile-guide-${guide.guide.slug}.png"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate QR code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
