import { businessRecordToClientConfig, type BusinessRecord } from "@/audit/businesses";
import { createAdminClient, isAdminSupabaseConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateWebhookToken } from "./webhook-token";
import { DEFAULT_WEBHOOK_TRIGGER_EVENTS, type WebhookBusinessSettings } from "./webhook-types";

function toSettings(row: BusinessRecord): WebhookBusinessSettings {
  if (!row.webhook_token) {
    throw new Error("Webhook token missing on business record");
  }

  return {
    businessId: row.id,
    userId: row.user_id,
    webhookToken: row.webhook_token,
    autoSend: row.webhook_auto_send ?? false,
    delayHours: row.webhook_delay_hours ?? 2,
    triggerEvents: row.webhook_trigger_events ?? [...DEFAULT_WEBHOOK_TRIGGER_EVENTS],
  };
}

export async function getWebhookBusinessByToken(
  token: string
): Promise<WebhookBusinessSettings | null> {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Webhook processing requires SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("webhook_token", token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.webhook_token) return null;
  return toSettings(data as BusinessRecord);
}

export async function ensureWebhookToken(
  userId: string,
  businessId: string
): Promise<WebhookBusinessSettings> {
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .eq("id", businessId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("Business not found");

  if (existing.webhook_token) {
    return toSettings(existing as BusinessRecord);
  }

  const token = generateWebhookToken();
  const { data, error } = await supabase
    .from("businesses")
    .update({
      webhook_token: token,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toSettings(data as BusinessRecord);
}

export async function getWebhookSettings(
  userId: string,
  businessId: string
): Promise<WebhookBusinessSettings> {
  return ensureWebhookToken(userId, businessId);
}

export async function updateWebhookSettings(
  userId: string,
  businessId: string,
  patch: {
    autoSend?: boolean;
    delayHours?: number;
    triggerEvents?: string[];
    rotateToken?: boolean;
    privateFeedbackUrl?: string | null;
  }
): Promise<WebhookBusinessSettings> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.autoSend !== undefined) update.webhook_auto_send = patch.autoSend;
  if (patch.delayHours !== undefined) update.webhook_delay_hours = patch.delayHours;
  if (patch.triggerEvents !== undefined) update.webhook_trigger_events = patch.triggerEvents;
  if (patch.rotateToken) update.webhook_token = generateWebhookToken();
  if (patch.privateFeedbackUrl !== undefined) {
    update.private_feedback_url = patch.privateFeedbackUrl?.trim() || null;
  }

  const { data, error } = await supabase
    .from("businesses")
    .update(update)
    .eq("user_id", userId)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toSettings(data as BusinessRecord);
}

export async function getBusinessConfigForWebhook(
  settings: WebhookBusinessSettings
) {
  if (!isAdminSupabaseConfigured()) {
    throw new Error("Webhook processing requires SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", settings.businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Business not found");
  return businessRecordToClientConfig(data as BusinessRecord);
}
