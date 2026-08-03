import { businessRecordToClientConfig } from "@/audit/businesses";
import { getBusinessRecordByIdAdmin } from "@/audit/businesses-admin";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { listScoreDailyForBusinessAdmin } from "@/audit/storage-score-daily";
import { maxActivityTimestamp } from "@/lib/admin/activity-timestamp";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeFromScore } from "@/lib/scores/grade";
import type { AdminBusinessDetail } from "@/lib/admin/types";

function formatLocation(location: { city?: string; state?: string } | null | undefined): string {
  if (!location) return "";
  return [location.city, location.state].filter(Boolean).join(", ");
}

export async function getAdminBusinessDetail(businessId: string): Promise<AdminBusinessDetail | null> {
  const record = await getBusinessRecordByIdAdmin(businessId);
  if (!record) return null;

  const supabase = createAdminClient();
  const [profileRes, scoreRes, tasksRes, taskCountsRes, auditsRes, scoreSeries] = await Promise.all([
    supabase.from("profiles").select("email, full_name").eq("id", record.user_id).maybeSingle(),
    supabase
      .from("admin_latest_scores")
      .select("overall, score_date")
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("execution_tasks")
      .select("id, title, task_type, priority, status, created_at, completed_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("execution_tasks").select("status").eq("business_id", businessId),
    supabase
      .from("audit_runs")
      .select("completed_at")
      .eq("business_id", businessId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    listScoreDailyForBusinessAdmin(businessId, 90),
  ]);

  const client = businessRecordToClientConfig(record);
  const latestAudit = await loadLatestAuditForBusinessAdmin(
    record.user_id,
    record.id,
    record.slug,
    record.name
  );

  const score = scoreRes.data?.overall ?? null;
  const taskRows = tasksRes.data ?? [];
  const allTaskStatuses = taskCountsRes.data ?? [];
  const pendingTasks = allTaskStatuses.filter((task) => task.status === "pending_approval").length;
  const completedTasks = allTaskStatuses.filter((task) => task.status === "completed").length;
  const failedTasks = allTaskStatuses.filter((task) => task.status === "failed").length;

  const rankings = latestAudit?.rankings;
  const scores = latestAudit?.strategy?.scores;

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    industry: record.industry,
    location: formatLocation(record.location),
    website: record.website,
    phone: record.phone,
    userId: record.user_id,
    userEmail: profileRes.data?.email ?? null,
    userName: profileRes.data?.full_name ?? null,
    onboardingComplete: record.onboarding_complete,
    gbpConnected: Boolean(record.gbp_location_id),
    autopilotMode: record.autopilot_mode,
    score,
    grade: score !== null ? gradeFromScore(score) : null,
    scoreDate: scoreRes.data?.score_date ?? null,
    pendingTasks,
    completedTasks,
    failedTasks,
    lastAuditAt: maxActivityTimestamp(
      auditsRes.data?.completed_at ?? null,
      scoreRes.data?.score_date ?? null
    ),
    keywordsInPack: rankings?.keywordsInPack ?? null,
    totalKeywords: rankings?.totalKeywords ?? null,
    auditScore: scores?.overall ?? null,
    auditGrade: scores?.grade ?? null,
    visibility: scores?.visibility ?? null,
    conversion: scores?.conversion ?? null,
    revenueCapture: scores?.revenueCapture ?? null,
    scoreSeries,
    recentTasks: taskRows.map((task) => ({
      id: task.id,
      businessId: record.id,
      businessName: record.name,
      title: task.title,
      taskType: task.task_type,
      priority: task.priority,
      status: task.status,
      createdAt: task.created_at,
      completedAt: task.completed_at,
    })),
  };
}
