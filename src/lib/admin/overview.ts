import { createAdminClient } from "@/lib/supabase/admin";
import { buildAdminAlerts, type AdminAlert } from "@/lib/admin/alerts";
import { getAllUserSummaries } from "@/lib/admin/users";
import type { AdminOverview } from "@/lib/admin/types";
import type { HealthGrade } from "@/audit/types";

async function fetchOverviewMetrics(users: Awaited<ReturnType<typeof getAllUserSummaries>>) {
  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setUTCDate(fourteenDaysAgo.getUTCDate() - 14);

  const [activeBusinessesRes, pendingTasksRes, completedTasksRes, lastIngestRes] = await Promise.all([
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
  const highChurnRiskUsers = users.filter((user) => user.churnRiskLevel === "high").length;
  const healthIndexes = users
    .map((user) => user.healthIndex)
    .filter((index): index is number => index !== null);
  const avgHealthIndex =
    healthIndexes.length > 0
      ? Math.round(healthIndexes.reduce((sum, index) => sum + index, 0) / healthIndexes.length)
      : null;

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

  const overview: AdminOverview = {
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
    highChurnRiskUsers,
    avgHealthIndex,
    alertCount: 0,
  };

  const alerts = buildAdminAlerts(users, overview);
  overview.alertCount = alerts.length;

  return { overview, alerts };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const users = await getAllUserSummaries();
  const { overview } = await fetchOverviewMetrics(users);
  return overview;
}

export async function getAdminDashboardData(): Promise<{
  overview: AdminOverview;
  alerts: AdminAlert[];
}> {
  const users = await getAllUserSummaries();
  return fetchOverviewMetrics(users);
}
