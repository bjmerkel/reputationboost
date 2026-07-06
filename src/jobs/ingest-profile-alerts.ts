import { listOnboardedBusinesses } from "@/audit/businesses-admin";
import type { IngestRunResult } from "@/audit/types/timeseries";
import { scanBusinessModeration } from "@/lib/google/gbp-moderation-scan";

export interface IngestProfileAlertsOptions {
  skipRunLog?: boolean;
}

function emptyResult(): IngestRunResult & { alertsRecorded: number } {
  return {
    jobName: "ingest-profile-alerts",
    businessesProcessed: 0,
    performanceRowsUpserted: 0,
    rankRowsUpserted: 0,
    scoreRowsUpserted: 0,
    calibrationStepsUpdated: 0,
    alertsRecorded: 0,
    errors: [],
  };
}

/**
 * Nightly profile moderation scan for onboarded businesses.
 * Complements Pub/Sub with a full pass over Google conflicts and review moderation.
 */
export async function ingestProfileAlerts(
  _options: IngestProfileAlertsOptions = {}
): Promise<IngestRunResult & { alertsRecorded: number }> {
  const result = emptyResult();
  const businesses = await listOnboardedBusinesses();

  for (const row of businesses) {
    try {
      const scan = await scanBusinessModeration(row);
      result.alertsRecorded += scan.eventsRecorded;
      result.businessesProcessed += 1;

      for (const message of scan.errors) {
        result.errors.push({
          businessId: row.id,
          step: "moderation-scan",
          message,
        });
      }
    } catch (error) {
      result.errors.push({
        businessId: row.id,
        step: "moderation-scan",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
