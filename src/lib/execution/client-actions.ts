import type { ExecutionTask, FullAuditPayload, Plan } from "@/audit/types";
import { isValidReviewId } from "@/audit/phase3/plan-task-utils";
import { needsGbpDescriptionRepublish } from "@/lib/google/gbp-description";
import { pendingRoutineTasks } from "./pending-tasks";

type ExecutionState = {
  tasks: ExecutionTask[];
  plan: Plan | null;
  planReconciledAt: string | null;
};

const inflightExecutionFetches = new Map<string, Promise<ExecutionState>>();

export async function fetchExecutionState(
  clientId: string,
  auditId: string,
  options?: { includePlan?: boolean }
): Promise<ExecutionState> {
  const includePlan = options?.includePlan !== false;
  const key = `${clientId}:${auditId}:${includePlan ? "plan" : "tasks"}`;
  const inflight = inflightExecutionFetches.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const params = new URLSearchParams({
      clientId,
      auditId,
    });
    if (!includePlan) {
      params.set("includePlan", "false");
    }

    const res = await fetch(`/api/execution?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load tasks");
    }
    return {
      tasks: data.tasks ?? [],
      plan: data.plan ?? null,
      planReconciledAt: data.planReconciledAt ?? null,
    };
  })();

  inflightExecutionFetches.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightExecutionFetches.delete(key);
  }
}

export async function reconcilePlan(
  clientId: string,
  auditId: string,
  options: { live?: boolean } = {}
): Promise<{
  planReconciledAt: string | null;
  createdTasks: number;
  completedTasks: number;
  gbpRefreshed?: boolean;
  live?: boolean;
  audit?: FullAuditPayload;
}> {
  const res = await fetch("/api/execution/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, auditId, live: options.live === true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to refresh plan");
  return {
    planReconciledAt: data.planReconciledAt ?? null,
    createdTasks: data.createdTasks ?? 0,
    completedTasks: data.completedTasks ?? 0,
    gbpRefreshed: data.gbpRefreshed ?? false,
    live: data.live ?? false,
    audit: data.audit,
  };
}

export async function patchExecutionTask(
  taskId: string,
  body: {
    status?: "approved" | "rejected";
    draftContent?: string;
    payload?: Record<string, unknown>;
  }
): Promise<ExecutionTask> {
  const res = await fetch(`/api/execution/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Update failed");
  return data.task as ExecutionTask;
}

export async function executeExecutionTask(
  taskId: string,
  options?: { retry?: boolean }
): Promise<ExecutionTask> {
  const res = await fetch(`/api/execution/${taskId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Publish failed");
  return data.task as ExecutionTask;
}

export async function regenerateReviewResponseTask(
  taskId: string,
  options?: { weaveKeyword?: boolean; keyword?: string }
): Promise<ExecutionTask> {
  const res = await fetch(`/api/execution/${taskId}/regenerate-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Regeneration failed");
  return data.task as ExecutionTask;
}

export async function checkTaskEditStatus(taskId: string): Promise<ExecutionTask> {
  const res = await fetch(`/api/execution/${taskId}/check-status`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Status check failed");
  return data.task as ExecutionTask;
}

export async function publishPhotoTask(
  taskId: string,
  previewDataUrl?: string,
  category = "ADDITIONAL"
): Promise<ExecutionTask> {
  if (previewDataUrl?.startsWith("data:")) {
    const blob = await (await fetch(previewDataUrl)).blob();
    const ext = blob.type.includes("png") ? "png" : "jpg";
    const file = new File([blob], `photo.${ext}`, { type: blob.type || "image/png" });
    return publishPhotoFile(taskId, file, category);
  }

  const res = await fetch(`/api/execution/${taskId}/publish-photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Photo upload failed");
  const task = data.task as ExecutionTask;
  if (task?.status === "failed") {
    throw new Error(task.result ?? "Photo upload failed");
  }
  return task;
}

export async function publishPhotoFile(taskId: string, file: File, category: string): Promise<ExecutionTask> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  form.append("mediaFormat", "PHOTO");

  const res = await fetch(`/api/execution/${taskId}/publish-photo`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Photo upload failed");
  return data.task as ExecutionTask;
}

export async function publishVideoFile(taskId: string, file: File, category: string): Promise<ExecutionTask> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  form.append("mediaFormat", "VIDEO");

  const res = await fetch(`/api/execution/${taskId}/publish-video`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Video upload failed");
  return data.task as ExecutionTask;
}

export async function publishPhotoBatch(
  files: File[],
  categories: string[]
): Promise<{ uploaded: number; total: number }> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  form.append("categories", JSON.stringify(categories));
  form.append("mediaFormat", "PHOTO");

  const res = await fetch("/api/google/gbp/media/batch", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Batch upload failed");
  return { uploaded: data.uploaded ?? 0, total: data.total ?? files.length };
}

export async function approveAndPublishTask(
  task: ExecutionTask,
  options?: { draftContent?: string; retry?: boolean; payload?: Record<string, unknown> }
): Promise<ExecutionTask> {
  if (task.type === "review_response" && !isValidReviewId(task.payload.reviewId)) {
    throw new Error(
      "This review reply is not linked to a specific review. Open Home or Plan to respond to customers."
    );
  }

  if (task.type === "gbp_photo") {
    const preview =
      typeof task.payload.previewDataUrl === "string" ? task.payload.previewDataUrl : undefined;
    if (!preview) {
      throw new Error("Generate or upload a photo preview before publishing.");
    }
    return publishPhotoTask(task.id, preview);
  }

  const draftContent = options?.draftContent?.trim();
  const retry = options?.retry ?? needsGbpDescriptionRepublish(task);

  if (draftContent && draftContent !== task.draftContent) {
    await patchExecutionTask(task.id, { draftContent });
  }

  if (options?.payload) {
    await patchExecutionTask(task.id, { payload: options.payload });
  }

  if (retry && task.status === "completed") {
    return executeExecutionTask(task.id, { retry: true });
  }

  if (task.status === "pending_approval") {
    await patchExecutionTask(task.id, { status: "approved" });
  } else if (task.status !== "approved") {
    throw new Error(`Task cannot be published from status: ${task.status}`);
  }

  return executeExecutionTask(task.id);
}

export async function approveAllRoutineTasks(tasks: ExecutionTask[]): Promise<number> {
  const routine = pendingRoutineTasks(tasks);
  for (const task of routine) {
    await approveAndPublishTask(task);
  }
  return routine.length;
}
