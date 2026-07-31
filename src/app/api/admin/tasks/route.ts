import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAction } from "@/lib/admin/auth";
import { listAdminTasks } from "@/lib/admin/tasks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApi("viewer");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const result = await listAdminTasks({
    status: searchParams.get("status") ?? undefined,
    taskType: searchParams.get("taskType") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    businessId: searchParams.get("businessId") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
  });

  await logAdminAction({
    adminUserId: auth.user.id,
    action: "list_tasks",
    targetType: "admin",
    targetId: "tasks",
  });

  return NextResponse.json(result);
}
