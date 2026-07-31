import { NextResponse } from "next/server";
import { cronFailureResponse, verifyCronRequest } from "@/lib/cron/route";
import { runAdminWeeklyDigest } from "@/jobs/admin-weekly-digest";

export const dynamic = "force-dynamic";

const JOB_NAME = "admin-weekly-digest";

/** Weekly admin digest email — Mondays 8:00 UTC */
export async function GET(request: Request) {
  const rejected = verifyCronRequest(request, JOB_NAME);
  if (rejected) return rejected;

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  try {
    const result = await runAdminWeeklyDigest({ force });
    console.info(`[cron/${JOB_NAME}] completed`, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return cronFailureResponse(JOB_NAME, error, "Admin digest failed");
  }
}
