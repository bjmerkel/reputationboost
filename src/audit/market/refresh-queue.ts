import { createAdminClient } from "@/lib/supabase/admin";

export interface MarketRefreshQueueItem {
  id: string;
  businessId: string;
  runAfter: string;
  triggerSource: "task_completion" | "gbp_event" | "gbp_identity_change";
  triggerRef: string | null;
  callsEstimated: number;
}

export async function enqueueEventRankPulse(input: {
  businessId: string;
  triggerSource: MarketRefreshQueueItem["triggerSource"];
  triggerRef?: string | null;
  runAfter: string;
  callsEstimated?: number;
}): Promise<string> {
  const supabase = createAdminClient();
  const { data: pending, error: readError } = await supabase
    .from("market_refresh_queue")
    .select("id,run_after")
    .eq("business_id", input.businessId)
    .eq("status", "pending")
    .maybeSingle();
  if (readError) throw new Error(`Failed to inspect market refresh queue: ${readError.message}`);

  if (pending) {
    const runAfter =
      new Date(input.runAfter).getTime() > new Date(pending.run_after as string).getTime()
        ? input.runAfter
        : (pending.run_after as string);
    const { error } = await supabase
      .from("market_refresh_queue")
      .update({
        run_after: runAfter,
        trigger_source: input.triggerSource,
        trigger_ref: input.triggerRef ?? null,
        calls_estimated: input.callsEstimated ?? 0,
      })
      .eq("id", pending.id);
    if (error) throw new Error(`Failed to coalesce market refresh: ${error.message}`);
    return pending.id as string;
  }

  const { data, error } = await supabase
    .from("market_refresh_queue")
    .insert({
      business_id: input.businessId,
      collection_type: "event_rank_pulse",
      trigger_source: input.triggerSource,
      trigger_ref: input.triggerRef ?? null,
      run_after: input.runAfter,
      calls_estimated: input.callsEstimated ?? 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to enqueue market refresh: ${error.message}`);
  return data.id as string;
}

export async function listDueMarketRefreshes(
  now: Date,
  limit = 10
): Promise<MarketRefreshQueueItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_refresh_queue")
    .select("id,business_id,run_after,trigger_source,trigger_ref,calls_estimated")
    .eq("status", "pending")
    .lte("run_after", now.toISOString())
    .order("run_after", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to list market refresh queue: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    businessId: row.business_id as string,
    runAfter: row.run_after as string,
    triggerSource: row.trigger_source as MarketRefreshQueueItem["triggerSource"],
    triggerRef: (row.trigger_ref as string | null) ?? null,
    callsEstimated: Number(row.calls_estimated ?? 0),
  }));
}

export async function getPendingMarketRefreshForBusiness(
  businessId: string
): Promise<{ runAfter: string; triggerSource: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("market_refresh_queue")
    .select("run_after,trigger_source")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw new Error(`Failed to read pending market refresh: ${error.message}`);
  return data
    ? {
        runAfter: data.run_after as string,
        triggerSource: data.trigger_source as string,
      }
    : null;
}

export async function markMarketRefreshQueueItem(
  id: string,
  status: "running" | "completed" | "skipped" | "failed",
  errorMessage?: string
): Promise<void> {
  const supabase = createAdminClient();
  const terminal = status === "completed" || status === "skipped" || status === "failed";
  const { error } = await supabase
    .from("market_refresh_queue")
    .update({
      status,
      error_message: errorMessage ?? null,
      completed_at: terminal ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to update market refresh queue: ${error.message}`);
}
