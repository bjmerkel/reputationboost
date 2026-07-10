import type { GbpEvent, RecordGbpEventInput } from "@/audit/types/gbp-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isScanManagedExternalId } from "@/lib/google/gbp-event-ids";

export { isScanManagedExternalId };

function rowToEvent(row: Record<string, unknown>): GbpEvent {
  return {
    id: String(row.id),
    businessId: String(row.business_id),
    userId: String(row.user_id),
    eventType: row.event_type as GbpEvent["eventType"],
    severity: row.severity as GbpEvent["severity"],
    source: row.source as GbpEvent["source"],
    title: String(row.title),
    message: String(row.message),
    externalId: row.external_id != null ? String(row.external_id) : null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    planStepNumber:
      row.plan_step_number != null ? Number(row.plan_step_number) : null,
    planScrollTarget:
      row.plan_scroll_target === "google-updates" ? "google-updates" : null,
    detectedAt: String(row.detected_at),
    acknowledgedAt: row.acknowledged_at != null ? String(row.acknowledged_at) : null,
    createdAt: String(row.created_at),
  };
}

function eventToDb(input: RecordGbpEventInput) {
  return {
    business_id: input.businessId,
    user_id: input.userId,
    event_type: input.eventType,
    severity: input.severity ?? "info",
    source: input.source,
    title: input.title,
    message: input.message,
    external_id: input.externalId ?? null,
    payload: input.payload ?? {},
    plan_step_number: input.planStepNumber ?? null,
    plan_scroll_target: input.planScrollTarget ?? null,
    detected_at: input.detectedAt ?? new Date().toISOString(),
  };
}

/** Insert or refresh an alert event (deduped by business + external_id). */
export async function recordGbpEventAdmin(input: RecordGbpEventInput): Promise<GbpEvent | null> {
  const supabase = createAdminClient();
  const row = eventToDb(input);

  if (input.externalId) {
    const { data, error } = await supabase
      .from("gbp_events")
      .upsert(row, { onConflict: "business_id,external_id" })
      .select()
      .single();

    if (error) throw new Error(`Failed to record gbp event: ${error.message}`);
    return rowToEvent(data);
  }

  const { data, error } = await supabase.from("gbp_events").insert(row).select().single();
  if (error) throw new Error(`Failed to record gbp event: ${error.message}`);
  return rowToEvent(data);
}

/**
 * Drop scan-managed alerts that were not re-detected in the latest pass.
 * Deletes (instead of acknowledging) so a returning condition can resurface.
 * Pub/Sub events (`pubsub:…`) are left alone unless `shouldClearExternalId` says otherwise.
 */
export async function clearStaleScanManagedGbpEventsAdmin(
  businessId: string,
  keepExternalIds: Iterable<string>,
  options?: {
    /** When set, only external ids matching this predicate are eligible for clearing. */
    shouldClearExternalId?: (externalId: string) => boolean;
  }
): Promise<number> {
  const supabase = createAdminClient();
  const keep = new Set(
    [...keepExternalIds].filter((id) => isScanManagedExternalId(id))
  );
  const shouldClear = options?.shouldClearExternalId ?? ((id: string) => isScanManagedExternalId(id));

  const { data, error } = await supabase
    .from("gbp_events")
    .select("id, external_id")
    .eq("business_id", businessId)
    .not("external_id", "is", null);

  if (error) {
    throw new Error(`Failed to list gbp events for reconcile: ${error.message}`);
  }

  const staleIds = (data ?? [])
    .filter((row) => {
      const externalId = row.external_id != null ? String(row.external_id) : null;
      if (!externalId || !isScanManagedExternalId(externalId)) return false;
      if (!shouldClear(externalId)) return false;
      return !keep.has(externalId);
    })
    .map((row) => String(row.id));

  if (staleIds.length === 0) return 0;

  const { error: deleteError } = await supabase
    .from("gbp_events")
    .delete()
    .eq("business_id", businessId)
    .in("id", staleIds);

  if (deleteError) {
    throw new Error(`Failed to clear stale gbp events: ${deleteError.message}`);
  }

  return staleIds.length;
}

export async function listActiveGbpEventsForUser(
  userId: string,
  businessId: string,
  limit = 20
): Promise<GbpEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gbp_events")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .is("acknowledged_at", null)
    .order("detected_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list gbp events: ${error.message}`);
  return (data ?? []).map((row) => rowToEvent(row));
}

export async function acknowledgeGbpEventForUser(
  userId: string,
  eventId: string
): Promise<GbpEvent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gbp_events")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to acknowledge gbp event: ${error.message}`);
  return data ? rowToEvent(data) : null;
}

export async function touchModerationScanAtAdmin(businessId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("businesses")
    .update({ gbp_moderation_scan_at: new Date().toISOString() })
    .eq("id", businessId);

  if (error) throw new Error(`Failed to update moderation scan timestamp: ${error.message}`);
}
