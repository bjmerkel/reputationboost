import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatRelativeDate } from "@/components/admin/AdminBadges";
import TaskFilters from "@/components/admin/TaskFilters";
import { logAdminAction, requireAdminPage } from "@/lib/admin/auth";
import { listAdminTasks, listDistinctTaskTypes } from "@/lib/admin/tasks";

export const metadata: Metadata = {
  title: "Tasks | Admin | Reputation Boost",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    taskType?: string;
    priority?: string;
    businessId?: string;
    userId?: string;
    page?: string;
  }>;
}

function buildTasksHref(params: {
  status?: string;
  taskType?: string;
  priority?: string;
  page: number;
}): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.taskType && params.taskType !== "all") search.set("taskType", params.taskType);
  if (params.priority && params.priority !== "all") search.set("priority", params.priority);
  if (params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/admin/tasks?${query}` : "/admin/tasks";
}

function statusClass(status: string): string {
  if (status === "pending_approval") return "text-amber-400";
  if (status === "completed") return "text-emerald-400";
  if (status === "failed") return "text-red-400";
  return "text-[#cbd5e1]";
}

export default async function AdminTasksPage({ searchParams }: PageProps) {
  const { userId } = await requireAdminPage("viewer");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));

  const [result, taskTypes] = await Promise.all([
    listAdminTasks({
      status: params.status,
      taskType: params.taskType,
      priority: params.priority,
      businessId: params.businessId,
      userId: params.userId,
      page,
    }),
    listDistinctTaskTypes(),
  ]);

  await logAdminAction({
    adminUserId: userId,
    action: "view_page",
    targetType: "admin",
    targetId: "tasks",
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#6366f1]">Tasks</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Global task queue</h1>
        <p className="mt-2 text-[#94a3b8]">
          {result.total} task{result.total === 1 ? "" : "s"} across all users.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-[#2d3348] bg-[#151923] p-4">
        <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-[#1e2433]" />}>
          <TaskFilters taskTypes={taskTypes} />
        </Suspense>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2d3348] bg-[#151923]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#1a1f2e] text-[#64748b]">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {result.tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#64748b]">
                    No tasks match these filters.
                  </td>
                </tr>
              ) : (
                result.tasks.map((task) => (
                  <tr key={task.id} className="border-t border-[#2d3348]/60 hover:bg-[#1a1f2e]/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{task.title}</p>
                      {task.result ? (
                        <p className="mt-1 max-w-xs truncate text-xs text-red-400">{task.result}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${task.userId}`}
                        className="text-[#cbd5e1] hover:text-[#a5b4fc]"
                      >
                        {task.userName || task.userEmail || task.userId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/businesses/${task.businessId}`}
                        className="text-[#94a3b8] hover:text-[#a5b4fc]"
                      >
                        {task.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8]">{task.taskType}</td>
                    <td className="px-4 py-3 text-[#cbd5e1]">{task.priority}</td>
                    <td className={`px-4 py-3 font-medium ${statusClass(task.status)}`}>
                      {task.status.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{formatRelativeDate(task.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[#2d3348] px-4 py-3 text-sm">
            <span className="text-[#64748b]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildTasksHref({ ...params, page: page - 1 })}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e2433]"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={buildTasksHref({ ...params, page: page + 1 })}
                  className="rounded-lg border border-[#334155] px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e2433]"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
