import { NextResponse } from "next/server";
import { processDueScheduledGooglePosts } from "@/lib/google/scheduled-posts";
import { isAdminSupabaseConfigured } from "@/lib/supabase/admin";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Vercel Cron: publish due scheduled Google Business Profile posts. */
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
    const result = await processDueScheduledGooglePosts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/process-scheduled-posts] failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Scheduled post processing failed",
      },
      { status: 500 }
    );
  }
}
