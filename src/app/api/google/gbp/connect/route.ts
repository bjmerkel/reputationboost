import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getBusinessRecord } from "@/audit/businesses";
import { buildGbpAuthUrl } from "@/lib/google/oauth";
import { isGoogleOAuthConfigured } from "@/lib/google/oauth-config";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/platform/onboard", request.url));
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const business = await getBusinessRecord(user.id, businessId);
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const state = randomBytes(24).toString("hex");
  const authUrl = buildGbpAuthUrl(state, { selectAccount: true });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(
    "gbp_oauth_state",
    JSON.stringify({ state, businessId, userId: user.id }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    }
  );

  return response;
}
