import { NextResponse } from "next/server";
import { logAdminAction, requireAdminApi } from "@/lib/admin/auth";
import { forceApproveTask } from "@/lib/admin/task-actions";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function PATCH(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi("operator");
  if (auth.error) return auth.error;

  const { taskId } = await context.params;
  const result = await forceApproveTask(taskId);

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Failed to approve task" }, { status: 400 });
  }

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "force_approve_task",
    targetType: "task",
    targetId: taskId,
    metadata: {
      previousStatus: result.previousStatus,
      newStatus: result.newStatus,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
