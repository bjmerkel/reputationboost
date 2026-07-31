import { NextResponse } from "next/server";
import { ingestDailyMetrics } from "@/jobs/ingest-daily";
import {
  cronFailureResponse,
  dynamic,
  verifyCronRequest,
} from "@/lib/cron/route";

export { dynamic };

/** Daily ingest can process every onboarded business sequentially. */
export const maxDuration = 300;

const JOB_NAME = "ingest-daily";

/** Daily GBP ingest; paid Places rank pulse runs only twice monthly. */
export async function GET(request: Request) {
  const rejected = verifyCronRequest(request, JOB_NAME);
  if (rejected) return rejected;

  try {
    const result = await ingestDailyMetrics();
    console.info(`[cron/${JOB_NAME}] completed`, {
      businessesProcessed: result.businessesProcessed,
      scoreRowsUpserted: result.scoreRowsUpserted,
      errorCount: result.errors.length,
    });
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return cronFailureResponse(JOB_NAME, error, "Ingest failed");
  }
}
