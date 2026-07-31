import { NextResponse } from "next/server";
import { processDueOutreachCampaignQueues } from "@/lib/review-requests/outreach-campaign";
import { isAdminSupabaseConfigured } from "@/lib/supabase/admin";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron: queue scheduled outreach rows for bulk campaigns. */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminSupabaseConfigured()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 }
    );
  }

  try {
    const result = await processDueOutreachCampaignQueues();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/process-outreach-campaigns] failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Outreach campaign queue processing failed",
      },
      { status: 500 }
    );
  }
}
