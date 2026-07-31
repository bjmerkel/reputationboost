import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminTaskListItem, AdminTaskListResult } from "@/lib/admin/types";

const PAGE_SIZE_DEFAULT = 50;

interface TaskRow {
  id: string;
  user_id: string;
  business_id: string;
  title: string;
  task_type: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  result: string | null;
}

export interface ListAdminTasksOptions {
  status?: string;
  taskType?: string;
  priority?: string;
  userId?: string;
  businessId?: string;
  page?: number;
  pageSize?: number;
}

export async function listAdminTasks(
  options: ListAdminTasksOptions = {}
): Promise<AdminTaskListResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? PAGE_SIZE_DEFAULT));
  const supabase = createAdminClient();

  let query = supabase
    .from("execution_tasks")
    .select(
      "id, user_id, business_id, title, task_type, priority, status, created_at, completed_at, result",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }
  if (options.taskType && options.taskType !== "all") {
    query = query.eq("task_type", options.taskType);
  }
  if (options.priority && options.priority !== "all") {
    query = query.eq("priority", options.priority);
  }
  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }
  if (options.businessId) {
    query = query.eq("business_id", options.businessId);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw new Error(`Failed to list admin tasks: ${error.message}`);

  const tasks = (data ?? []) as TaskRow[];
  const userIds = [...new Set(tasks.map((task) => task.user_id))];
  const businessIds = [...new Set(tasks.map((task) => task.business_id))];

  const [profilesRes, businessesRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, email, full_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    businessIds.length
      ? supabase.from("businesses").select("id, name").in("id", businessIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map(
    (profilesRes.data ?? []).map((profile) => [profile.id, profile])
  );
  const businessById = new Map(
    (businessesRes.data ?? []).map((business) => [business.id, business.name])
  );

  const items: AdminTaskListItem[] = tasks.map((task) => {
    const profile = profileById.get(task.user_id);
    return {
      id: task.id,
      userId: task.user_id,
      userEmail: profile?.email ?? null,
      userName: profile?.full_name ?? null,
      businessId: task.business_id,
      businessName: businessById.get(task.business_id) ?? "Unknown",
      title: task.title,
      taskType: task.task_type,
      priority: task.priority,
      status: task.status,
      createdAt: task.created_at,
      completedAt: task.completed_at,
      result: task.result,
    };
  });

  return {
    tasks: items,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function listDistinctTaskTypes(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("execution_tasks").select("task_type");
  if (error) return [];
  return [...new Set((data ?? []).map((row) => row.task_type as string))].sort();
}
