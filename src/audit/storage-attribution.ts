import type { ExecutionTask } from "@/audit/types";
import type {
  ActionAttribution,
  AttributionSummary,
  PerformanceDailyMetric,
} from "@/audit/types/timeseries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";

const ENGAGEMENT_METRICS: PerformanceDailyMetric[] = [
  "calls",
  "direction_requests",
  "website_clicks",
  "impressions_maps",
  "impressions_search",
];

function rowToAttribution(row: Record<string, unknown>, title = ""): ActionAttribution {
  const publishedAt = row.published_at as string;
  const windowDays = (row.window_days as number) ?? 14;
  const postEnd = new Date(publishedAt);
  postEnd.setUTCDate(postEnd.getUTCDate() + windowDays);

  return {
    id: row.id as string,
    executionTaskId: row.execution_task_id as string,
    businessId: row.business_id as string,
    taskType: row.task_type as string,
    actionItemId: row.action_item_id as string,
    title,
    publishedAt,
    windowDays,
    primaryKeyword: (row.primary_keyword as string) ?? null,
    rankBefore: (row.rank_before as number) ?? null,
    rankAfter: (row.rank_after as number) ?? null,
    rankDelta: (row.rank_delta as number) ?? null,
    keywordsImproved: (row.keywords_improved as number) ?? 0,
    callsDelta: (row.calls_delta as number) ?? null,
    directionsDelta: (row.directions_delta as number) ?? null,
    websiteClicksDelta: (row.website_clicks_delta as number) ?? null,
    impressionsDelta: (row.impressions_delta as number) ?? null,
    estimatedRevenue: row.estimated_revenue != null ? Number(row.estimated_revenue) : null,
    narrative: (row.narrative as string) ?? "",
    preliminary: new Date() < postEnd,
    computedAt: row.computed_at as string,
    projectedDriverImpact:
      row.projected_driver_impact != null ? Number(row.projected_driver_impact) : null,
    observedDriverImpact:
      row.observed_driver_impact != null ? Number(row.observed_driver_impact) : null,
    driverScoreBefore:
      row.driver_score_before != null ? Number(row.driver_score_before) : null,
    driverScoreAfter:
      row.driver_score_after != null ? Number(row.driver_score_after) : null,
    projectedOutcomeImpact:
      row.projected_outcome_impact != null ? Number(row.projected_outcome_impact) : null,
    projectedRevenueGain:
      row.projected_revenue_gain != null ? Number(row.projected_revenue_gain) : null,
  };
}

export interface AttributionUpsertInput {
  executionTaskId: string;
  businessId: string;
  taskType: string;
  actionItemId: string;
  title: string;
  publishedAt: string;
  windowDays: number;
  primaryKeyword: string | null;
  rankBefore: number | null;
  rankAfter: number | null;
  rankDelta: number | null;
  keywordsImproved: number;
  callsDelta: number;
  directionsDelta: number;
  websiteClicksDelta: number;
  impressionsDelta: number;
  estimatedRevenue: number | null;
  narrative: string;
  projectedDriverImpact?: number | null;
  observedDriverImpact?: number | null;
  driverScoreBefore?: number | null;
  driverScoreAfter?: number | null;
  projectedOutcomeImpact?: number | null;
  projectedRevenueGain?: number | null;
}

export async function upsertActionAttribution(input: AttributionUpsertInput): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("action_attributions").upsert(
    {
      execution_task_id: input.executionTaskId,
      business_id: input.businessId,
      task_type: input.taskType,
      action_item_id: input.actionItemId,
      published_at: input.publishedAt,
      window_days: input.windowDays,
      primary_keyword: input.primaryKeyword,
      rank_before: input.rankBefore,
      rank_after: input.rankAfter,
      rank_delta: input.rankDelta,
      keywords_improved: input.keywordsImproved,
      calls_delta: input.callsDelta,
      directions_delta: input.directionsDelta,
      website_clicks_delta: input.websiteClicksDelta,
      impressions_delta: input.impressionsDelta,
      estimated_revenue: input.estimatedRevenue,
      narrative: input.narrative,
      projected_driver_impact: input.projectedDriverImpact ?? null,
      observed_driver_impact: input.observedDriverImpact ?? null,
      driver_score_before: input.driverScoreBefore ?? null,
      driver_score_after: input.driverScoreAfter ?? null,
      projected_outcome_impact: input.projectedOutcomeImpact ?? null,
      projected_revenue_gain: input.projectedRevenueGain ?? null,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "execution_task_id" }
  );

  if (error) throw new Error(`Failed to upsert action_attribution: ${error.message}`);
}

export async function getRankSnapshotsInRange(
  businessId: string,
  keyword: string,
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; rank: number | null }>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rank_snapshots")
    .select("date, rank")
    .eq("business_id", businessId)
    .eq("keyword", keyword)
    .eq("distance_miles", 1)
    .eq("grid_north", 0)
    .eq("grid_east", 0)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) throw new Error(`Failed to load rank_snapshots: ${error.message}`);
  return (data ?? []).map((row) => ({
    date: row.date as string,
    rank: row.rank as number | null,
  }));
}

export async function sumPerformanceInRange(
  businessId: string,
  startDate: string,
  endDate: string,
  metrics: PerformanceDailyMetric[] = ENGAGEMENT_METRICS
): Promise<Record<PerformanceDailyMetric, number>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("performance_daily")
    .select("metric, value")
    .eq("business_id", businessId)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("metric", metrics);

  if (error) throw new Error(`Failed to load performance_daily: ${error.message}`);

  const totals = Object.fromEntries(metrics.map((m) => [m, 0])) as Record<
    PerformanceDailyMetric,
    number
  >;

  for (const row of data ?? []) {
    const metric = row.metric as PerformanceDailyMetric;
    if (metric in totals) {
      totals[metric] += row.value as number;
    }
  }

  return totals;
}

export async function listActionAttributionsForUser(
  userId: string,
  businessSlug: string,
  limit = 50
): Promise<ActionAttribution[]> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);
  if (!businessId) return [];

  const { data: tasks } = await supabase
    .from("execution_tasks")
    .select("id, title")
    .eq("user_id", userId)
    .eq("business_id", businessId);

  const titleByTaskId = new Map((tasks ?? []).map((t) => [t.id as string, t.title as string]));

  const { data, error } = await supabase
    .from("action_attributions")
    .select("*")
    .eq("business_id", businessId)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) =>
    rowToAttribution(row as Record<string, unknown>, titleByTaskId.get(row.execution_task_id) ?? "")
  );
}

export async function buildAttributionSummary(
  userId: string,
  businessSlug: string,
  periodDays = 30
): Promise<AttributionSummary> {
  const supabase = await createClient();
  const businessId = await getBusinessIdForSlug(userId, businessSlug);

  let avgCustomerValue: number | null = null;
  let currency = "USD";

  if (businessId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("avg_customer_value, avg_customer_value_currency")
      .eq("id", businessId)
      .maybeSingle();

    avgCustomerValue =
      business?.avg_customer_value != null ? Number(business.avg_customer_value) : null;
    currency = (business?.avg_customer_value_currency as string) ?? "USD";
  }

  const attributions = await listActionAttributionsForUser(userId, businessSlug, 100);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - periodDays);

  const inPeriod = attributions.filter((a) => new Date(a.publishedAt) >= cutoff);

  const totalCallsDelta = inPeriod.reduce((s, a) => s + (a.callsDelta ?? 0), 0);
  const totalDirectionsDelta = inPeriod.reduce((s, a) => s + (a.directionsDelta ?? 0), 0);
  const totalWebsiteClicksDelta = inPeriod.reduce((s, a) => s + (a.websiteClicksDelta ?? 0), 0);
  const keywordsImproved = inPeriod.reduce((s, a) => s + a.keywordsImproved, 0);

  const revenueSum = inPeriod.reduce((s, a) => s + (a.estimatedRevenue ?? 0), 0);
  const totalEstimatedRevenue =
    avgCustomerValue && avgCustomerValue > 0 && revenueSum > 0 ? revenueSum : null;

  const topWins = [...inPeriod]
    .sort((a, b) => {
      const aScore =
        (a.estimatedRevenue ?? 0) ||
        (a.callsDelta ?? 0) + (a.directionsDelta ?? 0) + (a.rankDelta ?? 0) * -1;
      const bScore =
        (b.estimatedRevenue ?? 0) ||
        (b.callsDelta ?? 0) + (b.directionsDelta ?? 0) + (b.rankDelta ?? 0) * -1;
      return bScore - aScore;
    })
    .slice(0, 5);

  const periodLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  return {
    period: periodLabel,
    periodDays,
    tasksCompleted: inPeriod.length,
    keywordsImproved,
    totalCallsDelta,
    totalDirectionsDelta,
    totalWebsiteClicksDelta,
    totalEstimatedRevenue,
    avgCustomerValue,
    currency,
    hasCustomerValue: Boolean(avgCustomerValue && avgCustomerValue > 0),
    topWins,
  };
}

export interface CompletedTaskRecord {
  task: ExecutionTask;
  businessId: string;
  userId: string;
  keywords: string[];
  avgCustomerValue: number | null;
  avgCustomerValueCurrency: string;
}

export async function listCompletedTasksForBusiness(
  businessId: string,
  lookbackDays = 60
): Promise<CompletedTaskRecord[]> {
  const supabase = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDays);

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("user_id, keywords, avg_customer_value, avg_customer_value_currency")
    .eq("id", businessId)
    .maybeSingle();

  if (bizError || !business) return [];

  const { data, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .gte("completed_at", since.toISOString())
    .order("completed_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    businessId,
    userId: business.user_id as string,
    keywords: (business.keywords as string[]) ?? [],
    avgCustomerValue:
      business.avg_customer_value != null ? Number(business.avg_customer_value) : null,
    avgCustomerValueCurrency: (business.avg_customer_value_currency as string) ?? "USD",
    task: {
      id: row.id as string,
      auditId: row.audit_id as string,
      actionItemId: row.action_item_id as string,
      type: row.task_type as ExecutionTask["type"],
      title: row.title as string,
      description: row.description as string,
      priority: row.priority as ExecutionTask["priority"],
      status: row.status as ExecutionTask["status"],
      draftContent: row.draft_content as string,
      payload: (row.payload as Record<string, unknown>) ?? {},
      requiresApproval: row.requires_approval as boolean,
      scheduledFor: (row.scheduled_for as string) ?? null,
      completedAt: (row.completed_at as string) ?? null,
      result: (row.result as string) ?? null,
      createdAt: row.created_at as string,
    },
  }));
}

export async function getCompletedTaskContext(
  userId: string,
  taskId: string
): Promise<CompletedTaskRecord | null> {
  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !task) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("keywords, avg_customer_value, avg_customer_value_currency")
    .eq("id", task.business_id)
    .maybeSingle();

  return {
    businessId: task.business_id as string,
    userId,
    keywords: (business?.keywords as string[]) ?? [],
    avgCustomerValue:
      business?.avg_customer_value != null ? Number(business.avg_customer_value) : null,
    avgCustomerValueCurrency: (business?.avg_customer_value_currency as string) ?? "USD",
    task: {
      id: task.id as string,
      auditId: task.audit_id as string,
      actionItemId: task.action_item_id as string,
      type: task.task_type as ExecutionTask["type"],
      title: task.title as string,
      description: task.description as string,
      priority: task.priority as ExecutionTask["priority"],
      status: task.status as ExecutionTask["status"],
      draftContent: task.draft_content as string,
      payload: (task.payload as Record<string, unknown>) ?? {},
      requiresApproval: task.requires_approval as boolean,
      scheduledFor: (task.scheduled_for as string) ?? null,
      completedAt: (task.completed_at as string) ?? null,
      result: (task.result as string) ?? null,
      createdAt: task.created_at as string,
    },
  };
}
