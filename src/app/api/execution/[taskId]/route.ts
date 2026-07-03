import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { executeTask } from "@/audit/phase3/executor";
import { getExecutionTask, updateExecutionTask } from "@/audit/storage-execution";
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
  };

  const task = await getExecutionTask(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updated = await updateExecutionTask(user.id, taskId, {
    status: body.status ?? task.status,
    draftContent: body.draftContent ?? task.draftContent,
    scheduledFor: body.status === "approved" ? new Date().toISOString() : task.scheduledFor,
  });

  return NextResponse.json({ task: updated });
}

export async function POST(
  _request: Request,
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

  if (task.status !== "approved") {
    return NextResponse.json(
      { error: "Task must be approved before execution" },
      { status: 400 }
    );
  }

  const business = await getPrimaryBusiness(user.id);
  const connection =
    business?.gbpConnection
      ? await getValidGbpConnection(user.id, business)
      : null;

  const executed = await executeTask(task, connection);
  const saved = await updateExecutionTask(user.id, taskId, {
    status: executed.status,
    completedAt: executed.completedAt,
    result: executed.result,
  });

  return NextResponse.json({ task: saved });
}
