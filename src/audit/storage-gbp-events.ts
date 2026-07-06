import type { GbpEvent, RecordGbpEventInput } from "@/audit/types/gbp-events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
