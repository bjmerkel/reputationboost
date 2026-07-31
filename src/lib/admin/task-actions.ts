import {
  getExecutionTaskAdmin,
  updateExecutionTaskAdmin,
} from "@/audit/storage-execution";

export interface AdminTaskActionResult {
  taskId: string;
  success: boolean;
  error?: string;
  previousStatus?: string;
  newStatus?: string;
}

const APPROVABLE_STATUSES = new Set(["pending_approval", "rejected"]);

export async function forceApproveTask(taskId: string): Promise<AdminTaskActionResult> {
  const task = await getExecutionTaskAdmin(taskId);
  if (!task) {
    return { taskId, success: false, error: "Task not found" };
  }

  if (!APPROVABLE_STATUSES.has(task.status)) {
    return {
      taskId,
      success: false,
      error: `Task cannot be approved from status "${task.status}"`,
      previousStatus: task.status,
    };
  }

  const updated = await updateExecutionTaskAdmin(taskId, {
    status: "approved",
    scheduledFor:
      task.type === "google_post" && task.scheduledFor
        ? task.scheduledFor
        : new Date().toISOString(),
  });

  if (!updated) {
    return { taskId, success: false, error: "Failed to update task", previousStatus: task.status };
  }

  return {
    taskId,
    success: true,
    previousStatus: task.status,
    newStatus: updated.status,
  };
}

export async function bulkApproveTasks(taskIds: string[]): Promise<{
  results: AdminTaskActionResult[];
  approved: number;
  failed: number;
}> {
  const uniqueIds = [...new Set(taskIds)].slice(0, 50);
  const results: AdminTaskActionResult[] = [];

  for (const taskId of uniqueIds) {
    results.push(await forceApproveTask(taskId));
  }

  const approved = results.filter((result) => result.success).length;
  return { results, approved, failed: results.length - approved };
}
