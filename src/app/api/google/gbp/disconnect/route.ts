import { NextResponse } from "next/server";
import { disconnectGbp, getBusinessRecord } from "@/audit/businesses";
import { revokeOAuthToken } from "@/lib/google/oauth";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { businessId?: string };
    if (!body.businessId?.trim()) {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    const business = await getBusinessRecord(user.id, body.businessId.trim());
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!business.gbp_refresh_token && !business.gbp_access_token) {
      return NextResponse.json({ error: "Google Business Profile is not connected" }, { status: 400 });
    }

    const tokenToRevoke = business.gbp_refresh_token ?? business.gbp_access_token;
    if (tokenToRevoke) {
      await revokeOAuthToken(tokenToRevoke);
    }

    await disconnectGbp(user.id, business.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect GBP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
