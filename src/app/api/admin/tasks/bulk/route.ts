import { NextResponse } from "next/server";
import { logAdminAction, requireAdminApi } from "@/lib/admin/auth";
import { bulkApproveTasks } from "@/lib/admin/task-actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApi("operator");
  if (auth.error) return auth.error;

  const body = (await request.json()) as { taskIds?: string[]; action?: string };
  if (body.action !== "approve") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const taskIds = Array.isArray(body.taskIds) ? body.taskIds : [];
  if (taskIds.length === 0) {
    return NextResponse.json({ error: "No tasks selected" }, { status: 400 });
  }

  const result = await bulkApproveTasks(taskIds);

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "bulk_approve_tasks",
    targetType: "task",
    targetId: "bulk",
    metadata: {
      taskIds,
      approved: result.approved,
      failed: result.failed,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
