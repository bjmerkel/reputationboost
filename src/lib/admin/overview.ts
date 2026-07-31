import { createAdminClient } from "@/lib/supabase/admin";
import { getAllUserSummaries } from "@/lib/admin/users";
import type { AdminOverview } from "@/lib/admin/types";
import type { HealthGrade } from "@/audit/types";

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = createAdminClient();
  const users = await getAllUserSummaries();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

  const [
    activeBusinessesRes,
    pendingTasksRes,
    completedTasksRes,
    lastIngestRes,
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true)
      .not("gbp_location_id", "is", null),
    supabase
      .from("execution_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval"),
    supabase
      .from("execution_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", sevenDaysAgoIso),
    supabase
      .from("ingest_runs")
      .select("status, completed_at, businesses_processed, errors")
      .eq("job_name", "ingest-daily")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const scoredUsers = users.filter((user) => user.avgScore !== null);
  const avgScore =
    scoredUsers.length > 0
      ? Math.round(
          scoredUsers.reduce((sum, user) => sum + (user.avgScore ?? 0), 0) / scoredUsers.length
        )
      : null;

  const gradeDistribution: Record<HealthGrade, number> = {
    healthy: 0,
    at_risk: 0,
    urgent: 0,
  };

  for (const user of users) {
    if (user.grade) {
      gradeDistribution[user.grade] += 1;
    }
  }

  const scoreMoversUp = users.filter((user) => (user.scoreDelta7d ?? 0) >= 5).length;
  const scoreMoversDown = users.filter((user) => (user.scoreDelta7d ?? 0) <= -5).length;
  const staleAccounts = users.filter((user) => {
    if (!user.lastAuditAt) return user.onboardedCount > 0;
    return new Date(user.lastAuditAt) < fourteenDaysAgo;
  }).length;

  const signups30d = users.filter((user) => new Date(user.createdAt) >= thirtyDaysAgo).length;

  const lastIngest = lastIngestRes.data
    ? {
        status: lastIngestRes.data.status as string,
        completedAt: lastIngestRes.data.completed_at as string | null,
        businessesProcessed: lastIngestRes.data.businesses_processed as number,
        errorCount: Array.isArray(lastIngestRes.data.errors)
          ? (lastIngestRes.data.errors as unknown[]).length
          : 0,
      }
    : null;

  return {
    totalUsers: users.length,
    activeBusinesses: activeBusinessesRes.count ?? 0,
    avgScore,
    gradeDistribution,
    pendingTasks: pendingTasksRes.count ?? 0,
    completedTasks7d: completedTasksRes.count ?? 0,
    scoreMoversUp,
    scoreMoversDown,
    staleAccounts,
    lastIngest,
    signups30d,
  };
}
