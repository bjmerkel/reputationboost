import { createAdminClient } from "@/lib/supabase/admin";

export interface IngestRunSummary {
  id: string;
  jobName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  businessesProcessed: number;
  performanceRowsUpserted: number;
  rankRowsUpserted: number;
  errorCount: number;
  placesCallsReserved: number;
  placesCollectionsSkipped: number;
  scoreRowsUpserted: number | null;
}

export interface IngestErrorDetail {
  businessId?: string;
  step?: string;
  message: string;
  runId: string;
  jobName: string;
  startedAt: string;
}

export interface PlatformHealthSnapshot {
  onboardedBusinesses: number;
  gbpConnected: number;
  gbpDisconnected: number;
  taskStatusCounts: Record<string, number>;
  placesCallsReserved: number;
  placesCallsBudget: number;
  placesBudgetUtilization: number | null;
  marketClaimsRunning: number;
  marketClaimsFailed: number;
  latestPerformanceDate: string | null;
}

export interface AdminOperationsData {
  recentRuns: IngestRunSummary[];
  lastRunByJob: IngestRunSummary[];
  recentErrors: IngestErrorDetail[];
  platformHealth: PlatformHealthSnapshot;
  cronSchedules: Array<{ jobName: string; schedule: string; path: string }>;
}

const CRON_SCHEDULES: AdminOperationsData["cronSchedules"] = [
  { jobName: "ingest-profile-alerts", schedule: "0 5 * * *", path: "/api/cron/ingest-profile-alerts" },
  { jobName: "ingest-daily", schedule: "0 6 * * *", path: "/api/cron/ingest-daily" },
  { jobName: "ingest-weekly-grid", schedule: "0 7 1 * *", path: "/api/cron/ingest-weekly-grid" },
  { jobName: "process-market-refresh", schedule: "0 * * * *", path: "/api/cron/process-market-refresh" },
  { jobName: "process-scheduled-sms", schedule: "*/5 * * * *", path: "/api/cron/process-scheduled-sms" },
  { jobName: "process-customer-imports", schedule: "*/5 * * * *", path: "/api/cron/process-customer-imports" },
  { jobName: "process-outreach-campaigns", schedule: "*/5 * * * *", path: "/api/cron/process-outreach-campaigns" },
  { jobName: "process-scheduled-posts", schedule: "*/15 * * * *", path: "/api/cron/process-scheduled-posts" },
  { jobName: "ingest-ai-visibility", schedule: "0 3 * * 0", path: "/api/cron/ingest-ai-visibility" },
  { jobName: "admin-weekly-digest", schedule: "0 8 * * 1", path: "/api/cron/admin-weekly-digest" },
];

function mapIngestRun(row: Record<string, unknown>): IngestRunSummary {
  const result = row.result as Record<string, unknown> | null;
  const errors = row.errors;
  return {
    id: row.id as string,
    jobName: row.job_name as string,
    status: row.status as string,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    businessesProcessed: (row.businesses_processed as number) ?? 0,
    performanceRowsUpserted: (row.performance_rows_upserted as number) ?? 0,
    rankRowsUpserted: (row.rank_rows_upserted as number) ?? 0,
    errorCount: Array.isArray(errors) ? errors.length : 0,
    placesCallsReserved: (row.places_calls_reserved as number) ?? 0,
    placesCollectionsSkipped: (row.places_collections_skipped as number) ?? 0,
    scoreRowsUpserted:
      result && typeof result.scoreRowsUpserted === "number"
        ? (result.scoreRowsUpserted as number)
        : null,
  };
}

function extractErrors(run: IngestRunSummary, rawErrors: unknown): IngestErrorDetail[] {
  if (!Array.isArray(rawErrors)) return [];

  return rawErrors.slice(0, 20).map((entry) => {
    const item = entry as Record<string, unknown>;
    return {
      businessId: typeof item.businessId === "string" ? item.businessId : undefined,
      step: typeof item.step === "string" ? item.step : undefined,
      message:
        typeof item.message === "string"
          ? item.message
          : typeof item.error === "string"
            ? item.error
            : JSON.stringify(item),
      runId: run.id,
      jobName: run.jobName,
      startedAt: run.startedAt,
    };
  });
}

export async function getAdminOperationsData(): Promise<AdminOperationsData> {
  const supabase = createAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthStartDate = monthStart.toISOString().slice(0, 10);

  const [
    runsRes,
    onboardedRes,
    gbpConnectedRes,
    tasksRes,
    placesUsageRes,
    marketClaimsRes,
    performanceRes,
  ] = await Promise.all([
    supabase
      .from("ingest_runs")
      .select(
        "id, job_name, status, started_at, completed_at, businesses_processed, performance_rows_upserted, rank_rows_upserted, errors, result, places_calls_reserved, places_collections_skipped"
      )
      .order("started_at", { ascending: false })
      .limit(40),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true)
      .not("gbp_location_id", "is", null),
    supabase.from("execution_tasks").select("status"),
    supabase
      .from("places_api_monthly_usage")
      .select("calls_reserved, calls_budget")
      .eq("month", monthStartDate),
    supabase.from("market_collection_claims").select("status"),
    supabase
      .from("performance_daily")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const recentRuns = (runsRes.data ?? []).map((row) => mapIngestRun(row as Record<string, unknown>));

  const lastRunByJobMap = new Map<string, IngestRunSummary>();
  for (const run of recentRuns) {
    if (!lastRunByJobMap.has(run.jobName)) {
      lastRunByJobMap.set(run.jobName, run);
    }
  }
  const lastRunByJob = [...lastRunByJobMap.values()].sort((a, b) =>
    a.jobName.localeCompare(b.jobName)
  );

  const recentErrors: IngestErrorDetail[] = [];
  for (const row of runsRes.data ?? []) {
    const run = mapIngestRun(row as Record<string, unknown>);
    if (run.errorCount > 0) {
      recentErrors.push(...extractErrors(run, row.errors));
    }
    if (recentErrors.length >= 25) break;
  }

  const taskStatusCounts: Record<string, number> = {};
  for (const task of tasksRes.data ?? []) {
    const status = task.status as string;
    taskStatusCounts[status] = (taskStatusCounts[status] ?? 0) + 1;
  }

  let placesCallsReserved = 0;
  let placesCallsBudget = 0;
  for (const row of placesUsageRes.data ?? []) {
    placesCallsReserved += (row.calls_reserved as number) ?? 0;
    placesCallsBudget += (row.calls_budget as number) ?? 0;
  }

  let marketClaimsRunning = 0;
  let marketClaimsFailed = 0;
  for (const claim of marketClaimsRes.data ?? []) {
    if (claim.status === "running") marketClaimsRunning += 1;
    if (claim.status === "failed") marketClaimsFailed += 1;
  }

  const onboardedBusinesses = onboardedRes.count ?? 0;
  const gbpConnected = gbpConnectedRes.count ?? 0;

  return {
    recentRuns,
    lastRunByJob,
    recentErrors: recentErrors.slice(0, 25),
    platformHealth: {
      onboardedBusinesses,
      gbpConnected,
      gbpDisconnected: Math.max(0, onboardedBusinesses - gbpConnected),
      taskStatusCounts,
      placesCallsReserved,
      placesCallsBudget,
      placesBudgetUtilization:
        placesCallsBudget > 0
          ? Math.round((placesCallsReserved / placesCallsBudget) * 100)
          : null,
      marketClaimsRunning,
      marketClaimsFailed,
      latestPerformanceDate: (performanceRes.data?.date as string | null) ?? null,
    },
    cronSchedules: CRON_SCHEDULES,
  };
}
