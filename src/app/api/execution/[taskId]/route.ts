import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { executeTask } from "@/audit/phase3/executor";
import { getExecutionTask, updateExecutionTask } from "@/audit/storage-execution";
import { computeAttributionAfterTaskCompletion } from "@/audit/attribution";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const body = (await request.json()) as {
    status?: "approved" | "rejected";
    draftContent?: string;
    payload?: Record<string, unknown>;
  };

  const task = await getExecutionTask(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const mergedPayload = body.payload
    ? { ...task.payload, ...body.payload }
    : task.payload;

  const updated = await updateExecutionTask(user.id, taskId, {
    status: body.status ?? task.status,
    draftContent: body.draftContent ?? task.draftContent,
    payload: body.payload ? mergedPayload : undefined,
    scheduledFor: body.status === "approved" ? new Date().toISOString() : task.scheduledFor,
  });

  return NextResponse.json({ task: updated });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await getExecutionTask(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let body: { retry?: boolean } = {};
  try {
    body = (await request.json()) as { retry?: boolean };
  } catch {
    body = {};
  }

  const retry = body.retry === true;
  const canExecute =
    task.status === "approved" ||
    (retry &&
      task.type === "gbp_description" &&
      (task.status === "completed" || task.status === "failed"));

  if (!canExecute) {
    return NextResponse.json(
      { error: "Task must be approved before execution" },
      { status: 400 }
    );
  }

  const business = await getPrimaryBusiness(user.id);
  if (task.type === "review_request" && !business) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const connection =
    business?.gbpConnection
      ? await getValidGbpConnection(user.id, business)
      : null;

  const executed = await executeTask(
    task,
    connection,
    business ? { userId: user.id, business } : undefined
  );
  const saved = await updateExecutionTask(user.id, taskId, {
    status: executed.status,
    completedAt: executed.completedAt,
    result: executed.result,
  });

  if (saved?.status === "completed") {
    void computeAttributionAfterTaskCompletion(user.id, taskId);
  }

  return NextResponse.json({ task: saved });
}
