import type { ClientConfig, ExecutionTask } from "@/audit/types";
import { createClient } from "@/lib/supabase/server";
import { normalizeTextContent } from "@/lib/llm/normalize-content";
import { getBusinessIdForSlug } from "./storage-supabase";
import { backfillTaskPlanFields, resolvePlanStepNumber } from "./phase3/plan-task-utils";

function rowToTask(row: Record<string, unknown>): ExecutionTask {
  const payload = (row.payload as Record<string, unknown>) ?? {};
  const rawStep = row.plan_step_number;
  const rawPhase = row.plan_phase_id;

  const task: ExecutionTask = {
    id: row.id as string,
    auditId: row.audit_id as string,
    actionItemId: row.action_item_id as string,
    type: row.task_type as ExecutionTask["type"],
    title: row.title as string,
    description: row.description as string,
    priority: row.priority as ExecutionTask["priority"],
    status: row.status as ExecutionTask["status"],
    draftContent: normalizeTextContent(row.draft_content),
    payload,
    requiresApproval: row.requires_approval as boolean,
    scheduledFor: (row.scheduled_for as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    result: (row.result as string) ?? null,
    createdAt: row.created_at as string,
    planStepNumber: typeof rawStep === "number" ? rawStep : null,
    planPhaseId:
      typeof rawPhase === "string" ? (rawPhase as ExecutionTask["planPhaseId"]) : null,
  };

  return backfillTaskPlanFields(task);
}

function taskToRow(
  task: ExecutionTask,
  userId: string,
  businessId: string
): Record<string, unknown> {
  return {
    id: task.id,
    business_id: businessId,
    user_id: userId,
    audit_id: task.auditId,
    action_item_id: task.actionItemId,
    task_type: task.type,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    draft_content: task.draftContent,
    payload: task.payload,
    requires_approval: task.requiresApproval,
    scheduled_for: task.scheduledFor,
    completed_at: task.completedAt,
    result: task.result,
    created_at: task.createdAt,
    plan_step_number: task.planStepNumber ?? resolvePlanStepNumber(task),
    plan_phase_id: task.planPhaseId ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function saveExecutionTasks(
  userId: string,
  client: ClientConfig,
  auditId: string,
  tasks: ExecutionTask[]
): Promise<void> {
  const supabase = await createClient();
  const businessId =
    client.businessId ?? (await getBusinessIdForSlug(userId, client.id));
  if (!businessId) throw new Error("Business not found");

  await supabase
    .from("execution_tasks")
    .delete()
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("audit_id", auditId)
    .in("status", ["pending_approval", "approved"])
    .not("action_item_id", "like", "autopilot-exp-%");

  if (tasks.length === 0) return;

  const rows = tasks.map((t) => taskToRow(t, userId, businessId));
  const { error } = await supabase.from("execution_tasks").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Failed to save execution tasks: ${error.message}`);
}

export async function listExecutionTasks(
  userId: string,
  businessSlug: string,
  auditId?: string
): Promise<ExecutionTask[]> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", businessSlug)
    .maybeSingle();

  if (!business?.id) return [];

  let query = supabase
    .from("execution_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", business.id)
    .order("created_at", { ascending: true });

  if (auditId) query = query.eq("audit_id", auditId);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => rowToTask(row));
}

export async function updateExecutionTask(
  userId: string,
  taskId: string,
  updates: Partial<
    Pick<ExecutionTask, "status" | "draftContent" | "completedAt" | "result" | "scheduledFor" | "payload">
  >
): Promise<ExecutionTask | null> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) patch.status = updates.status;
  if (updates.draftContent) patch.draft_content = updates.draftContent;
  if (updates.completedAt !== undefined) patch.completed_at = updates.completedAt;
  if (updates.result !== undefined) patch.result = updates.result;
  if (updates.scheduledFor !== undefined) patch.scheduled_for = updates.scheduledFor;
  if (updates.payload !== undefined) patch.payload = updates.payload;

  const { data, error } = await supabase
    .from("execution_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return rowToTask(data);
}

export async function appendExecutionTasks(
  userId: string,
  client: ClientConfig,
  tasks: ExecutionTask[]
): Promise<void> {
  if (tasks.length === 0) return;

  const supabase = await createClient();
  const businessId =
    client.businessId ?? (await getBusinessIdForSlug(userId, client.id));
  if (!businessId) throw new Error("Business not found");

  const rows = tasks.map((t) => taskToRow(t, userId, businessId));
  const { error } = await supabase.from("execution_tasks").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Failed to save execution tasks: ${error.message}`);
}

export async function listExecutionTasksForBusinessAdmin(
  userId: string,
  businessId: string,
  auditId: string
): Promise<ExecutionTask[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("audit_id", auditId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => rowToTask(row));
}

export async function appendExecutionTasksAdmin(
  userId: string,
  businessId: string,
  tasks: ExecutionTask[]
): Promise<void> {
  if (tasks.length === 0) return;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const rows = tasks.map((t) => taskToRow(t, userId, businessId));
  const { error } = await supabase.from("execution_tasks").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Failed to save execution tasks: ${error.message}`);
}

export async function getExecutionTask(
  userId: string,
  taskId: string
): Promise<ExecutionTask | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToTask(data);
}

export async function getExecutionTaskAdmin(taskId: string): Promise<ExecutionTask | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("execution_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToTask(data);
}

/** Admin status/content updates for cron reconcile (no user session). */
export async function updateExecutionTaskAdmin(
  taskId: string,
  updates: Partial<
    Pick<ExecutionTask, "status" | "draftContent" | "completedAt" | "result" | "scheduledFor" | "payload">
  >
): Promise<ExecutionTask | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status) patch.status = updates.status;
  if (updates.draftContent) patch.draft_content = updates.draftContent;
  if (updates.completedAt !== undefined) patch.completed_at = updates.completedAt;
  if (updates.result !== undefined) patch.result = updates.result;
  if (updates.scheduledFor !== undefined) patch.scheduled_for = updates.scheduledFor;
  if (updates.payload !== undefined) patch.payload = updates.payload;

  const { data, error } = await supabase
    .from("execution_tasks")
    .update(patch)
    .eq("id", taskId)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return rowToTask(data);
}
