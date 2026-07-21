import { NextResponse } from "next/server";
import { ingestAiVisibilityMetrics } from "@/jobs/ingest-ai-visibility";
import { isAdminSupabaseConfigured } from "@/lib/supabase/admin";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Weekly AI answer visibility probes for all onboarded businesses. */
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
    const result = await ingestAiVisibilityMetrics();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[cron/ingest-ai-visibility] failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "AI visibility ingest failed",
      },
      { status: 500 }
    );
  }
}
