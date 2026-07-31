import { NextResponse } from "next/server";
import {
  chainIngestDailyContinuation,
  ingestDailyMetrics,
  shouldChainIngestDaily,
} from "@/jobs/ingest-daily";
import {
  cronFailureResponse,
  verifyCronRequest,
} from "@/lib/cron/route";

/** Prevent Vercel from serving a cached cron response (silent no-op in logs). */
export const dynamic = "force-dynamic";

/** Daily ingest can process every onboarded business sequentially. */
export const maxDuration = 300;

const JOB_NAME = "ingest-daily";

/** Daily GBP ingest; paid Places rank pulse runs only twice monthly. */
export async function GET(request: Request) {
  const rejected = verifyCronRequest(request, JOB_NAME);
  if (rejected) return rejected;

  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get("offset") ?? "0");

  try {
    const result = await ingestDailyMetrics({
      offset: Number.isFinite(offset) ? offset : 0,
    });
    console.info(`[cron/${JOB_NAME}] completed`, {
      businessesProcessed: result.businessesProcessed,
      businessesTotal: result.businessesTotal,
      partial: result.partial ?? false,
      nextOffset: result.nextOffset ?? null,
      scoreRowsUpserted: result.scoreRowsUpserted,
      errorCount: result.errors.length,
    });

    if (
      result.partial &&
      result.nextOffset != null &&
      result.businessesTotal != null &&
      shouldChainIngestDaily(result.businessesTotal, result.nextOffset)
    ) {
      void chainIngestDailyContinuation(result.nextOffset, request.url).catch((error) => {
        console.error(`[cron/${JOB_NAME}] continuation failed:`, error);
      });
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return cronFailureResponse(JOB_NAME, error, "Ingest failed");
  }
}
