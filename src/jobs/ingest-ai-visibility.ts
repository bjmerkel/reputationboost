import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import { businessRecordToClientConfig } from "@/audit/businesses";
import {
  collectAiVisibilityProbes,
  probesToSnapshotRows,
} from "@/audit/collectors/ai-visibility";
import {
  completeIngestRun,
  failIngestRun,
  startIngestRun,
} from "@/audit/storage-timeseries";
import { upsertAiVisibilitySnapshots } from "@/audit/storage-ai-visibility";
import type { IngestRunResult } from "@/audit/types/timeseries";
import { AI_VISIBILITY_FLAGS } from "@/lib/feature-flags";

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function emptyResult(): IngestRunResult & { aiVisibilityRowsUpserted: number } {
  return {
    jobName: "ingest-ai-visibility",
    businessesProcessed: 0,
    performanceRowsUpserted: 0,
    rankRowsUpserted: 0,
    scoreRowsUpserted: 0,
    calibrationStepsUpdated: 0,
    aiVisibilityRowsUpserted: 0,
    errors: [],
  };
}

export function shouldRunWeeklyAiVisibility(date: Date): boolean {
  return date.getUTCDay() === AI_VISIBILITY_FLAGS.weeklyProbeDayUtc;
}

export interface IngestAiVisibilityOptions {
  targetDate?: Date;
  skipRunLog?: boolean;
}

export async function ingestAiVisibilityMetrics(
  options: IngestAiVisibilityOptions = {}
): Promise<IngestRunResult & { aiVisibilityRowsUpserted: number }> {
  if (!AI_VISIBILITY_FLAGS.enabled) {
    return emptyResult();
  }

  const targetDate = options.targetDate ?? new Date();
  const dateYmd = formatDateYmd(targetDate);
  const result = emptyResult();
  const runId = options.skipRunLog ? null : await startIngestRun("ingest-ai-visibility");

  try {
    const businesses = await listOnboardedBusinesses();

    for (const business of businesses) {
      try {
        const client = businessRecordToClientConfig(business);
        if (client.keywords.length === 0) continue;

        const { probes } = await collectAiVisibilityProbes(client);
        const rows = probesToSnapshotRows(probes, business.id, dateYmd);
        result.aiVisibilityRowsUpserted += await upsertAiVisibilitySnapshots(rows);
        result.businessesProcessed += 1;
      } catch (error) {
        result.errors.push({
          businessId: business.id,
          step: "ai_visibility",
          message: error instanceof Error ? error.message : "AI visibility ingest failed",
        });
      }
    }

    if (runId) {
      await completeIngestRun(runId, result);
    }

    return result;
  } catch (error) {
    if (runId) {
      await failIngestRun(
        runId,
        result,
        error instanceof Error ? error.message : "AI visibility ingest failed"
      );
    }
    throw error;
  }
}
