import { businessRecordToClientConfig } from "@/audit/businesses";
import type { BusinessRecord } from "@/audit/businesses";
import { executeTask } from "@/audit/phase3/executor";
import { computeAttributionAfterTaskCompletion } from "@/audit/attribution";
import {
  listDueScheduledGooglePostTasksAdmin,
  updateExecutionTaskAdmin,
} from "@/audit/storage-execution";
import { insertUserNotificationAdmin } from "@/audit/storage-notifications";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";
import { createAdminClient } from "@/lib/supabase/admin";

async function notifyScheduledPostFailure(
  userId: string,
  businessId: string,
  taskTitle: string,
  message: string
): Promise<void> {
  try {
    await insertUserNotificationAdmin({
      userId,
      businessId,
      type: "scheduled_post_failed",
      title: "Scheduled Google post failed",
      body: `${taskTitle}: ${message}`,
    });
  } catch (error) {
    console.error("[scheduled-posts] failed to insert notification:", error);
  }
}

async function markScheduledPostFailed(
  taskId: string,
  userId: string,
  businessId: string,
  taskTitle: string,
  message: string
): Promise<void> {
  await updateExecutionTaskAdmin(taskId, {
    status: "failed",
    completedAt: new Date().toISOString(),
    result: message,
  });
  await notifyScheduledPostFailure(userId, businessId, taskTitle, message);
}

async function loadBusinessRecord(businessId: string): Promise<BusinessRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("businesses").select("*").eq("id", businessId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as BusinessRecord | null;
}

export async function processDueScheduledGooglePosts(): Promise<{
  processed: number;
  published: number;
  failed: number;
  skipped: number;
}> {
  const due = await listDueScheduledGooglePostTasksAdmin();
  let published = 0;
  let failed = 0;
  let skipped = 0;

  for (const { task, userId, businessId } of due) {
    try {
      const businessRow = await loadBusinessRecord(businessId);
      if (!businessRow) {
        await markScheduledPostFailed(
          task.id,
          userId,
          businessId,
          task.title,
          "Business not found for scheduled post."
        );
        failed++;
        continue;
      }

      const client = businessRecordToClientConfig(businessRow);
      const connection = await getValidGbpConnectionForRecord(businessRow);
      if (!connection) {
        await markScheduledPostFailed(
          task.id,
          userId,
          businessId,
          task.title,
          "Google Business Profile is not connected — reconnect to publish scheduled posts."
        );
        failed++;
        continue;
      }

      const executed = await executeTask(task, connection, { userId, business: client });
      const saved = await updateExecutionTaskAdmin(task.id, {
        status: executed.status,
        completedAt: executed.completedAt,
        result: executed.result,
      });

      if (saved?.status === "completed") {
        published++;
        void computeAttributionAfterTaskCompletion(userId, task.id);
      } else {
        failed++;
        await notifyScheduledPostFailure(
          userId,
          businessId,
          task.title,
          saved?.result ?? "Publish failed"
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scheduled post publish failed";
      await markScheduledPostFailed(task.id, userId, businessId, task.title, message);
      failed++;
    }
  }

  return {
    processed: due.length,
    published,
    failed,
    skipped,
  };
}

