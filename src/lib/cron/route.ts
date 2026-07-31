import { NextResponse } from "next/server";
import { isAdminSupabaseConfigured } from "@/lib/supabase/admin";

function trimSecret(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

export function verifyCronRequest(
  request: Request,
  jobName: string
): NextResponse | null {
  const secret = trimSecret(process.env.CRON_SECRET);
  const auth = request.headers.get("authorization")?.trim();
  const schedule = request.headers.get("x-vercel-cron-schedule");
  const isVercelCron = Boolean(schedule);

  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[cron/${jobName}] starting (development, CRON_SECRET unset)`);
      return null;
    }

    console.warn(`[cron/${jobName}] rejected: CRON_SECRET is not configured`);
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (auth !== `Bearer ${secret}`) {
    console.warn(`[cron/${jobName}] rejected: unauthorized`, {
      hasAuthHeader: Boolean(auth),
      vercelCron: isVercelCron,
      schedule,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminSupabaseConfigured()) {
    console.warn(`[cron/${jobName}] rejected: SUPABASE_SERVICE_ROLE_KEY is not configured`);
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 }
    );
  }

  console.info(`[cron/${jobName}] starting`, {
    vercelCron: isVercelCron,
    schedule,
  });
  return null;
}

export function cronFailureResponse(
  jobName: string,
  error: unknown,
  fallbackMessage: string
): NextResponse {
  console.error(`[cron/${jobName}] failed:`, error);
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallbackMessage,
    },
    { status: 500 }
  );
}
