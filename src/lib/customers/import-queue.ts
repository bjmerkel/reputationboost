import { createAdminClient } from "@/lib/supabase/admin";
import { bulkImportCustomers } from "@/lib/customers/bulk-upsert";
import {
  parseCustomerCsvChunk,
  parseCustomerJsonChunk,
} from "@/lib/customers/parse-import";
import {
  IMPORT_CHUNK_SIZE,
  IMPORT_CHUNKS_PER_JOB_PER_CRON,
  IMPORT_JOBS_PER_CRON_RUN,
} from "@/lib/review-requests/bulk-config";

export type CustomerImportJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface CustomerImportJobRecord {
  id: string;
  businessId: string;
  userId: string;
  status: CustomerImportJobStatus;
  importFormat: "csv" | "json";
  totalRows: number;
  processedRows: number;
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  skippedCount: number;
  parseLineOffset: number;
  parseErrors: string[];
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

function rowToJob(row: Record<string, unknown>): CustomerImportJobRecord {
  return {
    id: row.id as string,
    businessId: row.business_id as string,
    userId: row.user_id as string,
    status: row.status as CustomerImportJobStatus,
    importFormat: row.import_format as "csv" | "json",
    totalRows: Number(row.total_rows ?? 0),
    processedRows: Number(row.processed_rows ?? 0),
    importedCount: Number(row.imported_count ?? 0),
    updatedCount: Number(row.updated_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    parseLineOffset: Number(row.parse_line_offset ?? 0),
    parseErrors: Array.isArray(row.parse_errors)
      ? (row.parse_errors as string[])
      : [],
    errorMessage: (row.error_message as string | null) ?? null,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

export async function enqueueCustomerImportJob(input: {
  userId: string;
  businessId: string;
  importFormat: "csv" | "json";
  rawCsv?: string;
  rawJson?: unknown[];
  totalRows: number;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_import_jobs")
    .insert({
      business_id: input.businessId,
      user_id: input.userId,
      status: "pending",
      import_format: input.importFormat,
      raw_csv: input.importFormat === "csv" ? input.rawCsv : null,
      raw_json: input.importFormat === "json" ? input.rawJson : null,
      total_rows: input.totalRows,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to enqueue import job: ${error.message}`);
  return data.id as string;
}

export async function getCustomerImportJob(
  jobId: string,
  userId: string
): Promise<CustomerImportJobRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToJob(data) : null;
}

export async function listCustomerImportJobs(
  businessId: string,
  userId: string,
  limit = 10
): Promise<CustomerImportJobRecord[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_import_jobs")
    .select("*")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToJob(row));
}

export async function getImportJobForProcessing(
  jobId: string
): Promise<(CustomerImportJobRecord & { rawCsv: string | null; rawJson: unknown[] | null }) | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_import_jobs")
    .select("*")
    .eq("id", jobId)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...rowToJob(data),
    rawCsv: (data.raw_csv as string | null) ?? null,
    rawJson: Array.isArray(data.raw_json) ? (data.raw_json as unknown[]) : null,
  };
}

export async function listPendingImportJobs(
  limit = IMPORT_JOBS_PER_CRON_RUN
): Promise<Array<CustomerImportJobRecord & { rawCsv: string | null; rawJson: unknown[] | null }>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_import_jobs")
    .select("*")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    ...rowToJob(row),
    rawCsv: (row.raw_csv as string | null) ?? null,
    rawJson: Array.isArray(row.raw_json) ? (row.raw_json as unknown[]) : null,
  }));
}

async function markImportJob(
  jobId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("customer_import_jobs")
    .update(patch)
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

export async function processCustomerImportJobChunk(
  job: CustomerImportJobRecord & { rawCsv: string | null; rawJson: unknown[] | null }
): Promise<{ done: boolean }> {
  const supabase = createAdminClient();

  if (job.status === "pending") {
    await markImportJob(job.id, {
      status: "processing",
      started_at: new Date().toISOString(),
    });
  }

  let chunkRows: Awaited<ReturnType<typeof parseCustomerCsvChunk>>;
  let itemsConsumed = 0;

  if (job.importFormat === "csv") {
    if (!job.rawCsv) {
      await markImportJob(job.id, {
        status: "failed",
        error_message: "Missing CSV payload",
        completed_at: new Date().toISOString(),
      });
      return { done: true };
    }

    chunkRows = parseCustomerCsvChunk(job.rawCsv, job.parseLineOffset, IMPORT_CHUNK_SIZE);
    itemsConsumed = chunkRows.linesConsumed;
  } else {
    if (!job.rawJson) {
      await markImportJob(job.id, {
        status: "failed",
        error_message: "Missing JSON payload",
        completed_at: new Date().toISOString(),
      });
      return { done: true };
    }

    const jsonChunk = parseCustomerJsonChunk(
      job.rawJson,
      job.parseLineOffset,
      IMPORT_CHUNK_SIZE
    );
    chunkRows = {
      rows: jsonChunk.rows,
      skipped: jsonChunk.skipped,
      errors: jsonChunk.errors,
      linesConsumed: jsonChunk.itemsConsumed,
      done: jsonChunk.done,
    };
    itemsConsumed = jsonChunk.itemsConsumed;
  }

  let importResult = { imported: 0, updated: 0, failed: 0 };
  if (chunkRows.rows.length > 0) {
    importResult = await bulkImportCustomers(
      supabase,
      job.userId,
      job.businessId,
      chunkRows.rows
    );
  }

  const mergedErrors = [...job.parseErrors, ...chunkRows.errors].slice(-50);
  const nextOffset = job.parseLineOffset + itemsConsumed;
  const processedRows = job.processedRows + itemsConsumed;
  const done = chunkRows.done || itemsConsumed === 0;

  if (done) {
    await markImportJob(job.id, {
      status: "completed",
      processed_rows: processedRows,
      imported_count: job.importedCount + importResult.imported,
      updated_count: job.updatedCount + importResult.updated,
      failed_count: job.failedCount + importResult.failed,
      skipped_count: job.skippedCount + chunkRows.skipped,
      parse_line_offset: nextOffset,
      parse_errors: mergedErrors,
      completed_at: new Date().toISOString(),
    });
    return { done: true };
  }

  await markImportJob(job.id, {
    status: "pending",
    processed_rows: processedRows,
    imported_count: job.importedCount + importResult.imported,
    updated_count: job.updatedCount + importResult.updated,
    failed_count: job.failedCount + importResult.failed,
    skipped_count: job.skippedCount + chunkRows.skipped,
    parse_line_offset: nextOffset,
    parse_errors: mergedErrors,
  });

  return { done: false };
}

export interface ProcessCustomerImportsResult {
  processed: number;
  completed: number;
  failed: number;
}

export async function processDueCustomerImports(): Promise<ProcessCustomerImportsResult> {
  const result: ProcessCustomerImportsResult = {
    processed: 0,
    completed: 0,
    failed: 0,
  };

  const jobs = await listPendingImportJobs();

  for (const job of jobs) {
    result.processed++;
    try {
      let currentJob: Awaited<ReturnType<typeof getImportJobForProcessing>> = job;
      let done = false;
      for (let chunk = 0; chunk < IMPORT_CHUNKS_PER_JOB_PER_CRON && currentJob && !done; chunk++) {
        const chunkResult = await processCustomerImportJobChunk(currentJob);
        done = chunkResult.done;
        if (!done) {
          currentJob = await getImportJobForProcessing(job.id);
        }
      }
      if (done) result.completed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "import_chunk_failed";
      await markImportJob(job.id, {
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      });
      result.failed++;
    }
  }

  return result;
}
