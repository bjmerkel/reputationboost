import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  copyGbpTokensFromBusiness,
  getBusinessRecord,
} from "@/audit/businesses";
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

  const { searchParams, origin } = new URL(request.url);
  const businessId = searchParams.get("businessId");
  const reuseFromBusinessId = searchParams.get("reuseFromBusinessId");

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const business = await getBusinessRecord(user.id, businessId);
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (reuseFromBusinessId) {
    const source = await getBusinessRecord(user.id, reuseFromBusinessId);
    if (!source?.gbp_refresh_token) {
      return NextResponse.json(
        { error: "Selected Google account is not connected." },
        { status: 400 }
      );
    }

    await copyGbpTokensFromBusiness(user.id, reuseFromBusinessId, businessId);

    const redirectUrl = new URL("/platform/onboard", origin);
    redirectUrl.searchParams.set("businessId", businessId);
    redirectUrl.searchParams.set("sourceBusinessId", reuseFromBusinessId);

    if (searchParams.get("mode") === "import") {
      redirectUrl.searchParams.set("add", "1");
      redirectUrl.searchParams.set("step", "import");
    } else {
      redirectUrl.searchParams.set("step", "location");
    }

    return NextResponse.redirect(redirectUrl);
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
