import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AutopilotNotificationType =
  | "suggestion_created"
  | "experiment_queued"
  | "experiment_concluded";

export interface UserNotification {
  id: string;
  userId: string;
  businessId: string;
  type: AutopilotNotificationType;
  experimentId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

function rowToNotification(row: Record<string, unknown>): UserNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    businessId: row.business_id as string,
    type: row.type as AutopilotNotificationType,
    experimentId: (row.experiment_id as string) ?? null,
    title: row.title as string,
    body: row.body as string,
    readAt: (row.read_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function insertUserNotificationAdmin(input: {
  userId: string;
  businessId: string;
  type: AutopilotNotificationType;
  experimentId?: string | null;
  title: string;
  body: string;
}): Promise<UserNotification> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_notifications")
    .insert({
      user_id: input.userId,
      business_id: input.businessId,
      type: input.type,
      experiment_id: input.experimentId ?? null,
      title: input.title,
      body: input.body,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert notification: ${error?.message}`);
  }
  return rowToNotification(data);
}

export async function listUnreadNotificationsForUser(
  userId: string,
  businessId: string,
  limit = 10
): Promise<UserNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => rowToNotification(row));
}

export async function markNotificationsReadForUser(
  userId: string,
  businessId: string,
  notificationIds?: string[]
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .is("read_at", null);

  if (notificationIds?.length) {
    query = query.in("id", notificationIds);
  }

  const { data, error } = await query.select("id");
  if (error) return 0;
  return data?.length ?? 0;
}
