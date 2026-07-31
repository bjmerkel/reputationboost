/** Shared limits and pacing for bulk customer import and outreach workers. */

export const MAX_CSV_ROWS = 10000;

export const IMPORT_CHUNK_SIZE = 500;

export const LARGE_IMPORT_ROW_THRESHOLD = 500;

/** Max import jobs processed per cron invocation. */
export const IMPORT_JOBS_PER_CRON_RUN = 2;

/** Max CSV/JSON chunks processed per job per cron tick. */
export const IMPORT_CHUNKS_PER_JOB_PER_CRON = 5;

/** Per-channel batch size when draining scheduled outreach in cron. */
export const OUTREACH_CRON_BATCH_LIMIT = 200;

/** Delay between provider API calls in the outreach worker (ms). */
export const OUTREACH_SEND_DELAY_MS = 150;

export const DEFAULT_DAILY_SEND_CAP = 100;

export const OUTREACH_MAX_RETRIES = 3;

/** Minutes to defer a message after a retryable provider failure. */
export const OUTREACH_RETRY_DELAY_MINUTES = 15;

export function isBulkOutreachEnabled(): boolean {
  const flag = process.env.BULK_OUTREACH_ENABLED?.trim().toLowerCase();
  if (!flag) return true;
  return flag !== "0" && flag !== "false" && flag !== "off";
}
