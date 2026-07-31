import { NextResponse } from "next/server";
import { cancelOutreachCampaign } from "@/lib/review-requests/outreach-campaign";
import { getUser } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await cancelOutreachCampaign(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
