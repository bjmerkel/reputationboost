import { createAdminClient } from "@/lib/supabase/admin";
import { gradeFromScore } from "@/lib/scores/grade";
import type {
  AdminBusinessSummary,
  AdminTaskSummary,
  AdminUserBusinessPreview,
  AdminUserDetail,
  AdminUserListResult,
  AdminUserSummary,
  UserStatus,
} from "@/lib/admin/types";
import type { HealthGrade } from "@/audit/types";

const PAGE_SIZE_DEFAULT = 25;

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

interface BusinessRow {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  industry: string;
  location: { city?: string; state?: string; address?: string } | null;
  onboarding_complete: boolean;
  gbp_location_id: string | null;
  autopilot_mode: string;
}

interface ScoreRow {
  business_id: string;
  overall: number;
  score_date: string;
}

interface ScoreHistoryRow {
  business_id: string;
  overall: number;
  date: string;
}

interface TaskAggRow {
  user_id: string;
  status: string;
}

interface AuditAggRow {
  user_id: string;
  completed_at: string;
}

interface BusinessAuditRow {
  business_id: string;
  completed_at: string;
}

function formatLocation(location: BusinessRow["location"]): string {
  if (!location) return "";
  return [location.city, location.state].filter(Boolean).join(", ");
}

function deriveUserStatus(input: {
  onboardedCount: number;
  businessCount: number;
  grade: HealthGrade | null;
  lastActivityAt: string | null;
}): UserStatus {
  if (input.businessCount === 0) return "signed_up";
  if (input.onboardedCount === 0) return "never_onboarded";

  const daysSinceActivity = input.lastActivityAt
    ? Math.floor((Date.now() - new Date(input.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceActivity > 21) return "churning";
  if (input.grade === "urgent") return "at_risk";
  return "active";
}

function dominantMode(modes: string[]): string | null {
  if (modes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const mode of modes) {
    counts.set(mode, (counts.get(mode) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function fetchAdminBaseData() {
  const supabase = createAdminClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const [
    profilesRes,
    businessesRes,
    scoresRes,
    scoreHistoryRes,
    tasksRes,
    auditsRes,
    businessAuditsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
    supabase
      .from("businesses")
      .select(
        "id, user_id, slug, name, industry, location, onboarding_complete, gbp_location_id, autopilot_mode"
      ),
    supabase.from("admin_latest_scores").select("business_id, overall, score_date"),
    supabase
      .from("score_daily")
      .select("business_id, overall, date")
      .eq("date", sevenDaysAgo.toISOString().slice(0, 10)),
    supabase.from("execution_tasks").select("user_id, status, business_id, id, title, task_type, priority, created_at, completed_at"),
    supabase.from("audit_runs").select("user_id, completed_at").order("completed_at", { ascending: false }),
    supabase.from("audit_runs").select("business_id, completed_at").order("completed_at", { ascending: false }),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (businessesRes.error) throw new Error(businessesRes.error.message);
  if (scoresRes.error) throw new Error(scoresRes.error.message);
  if (scoreHistoryRes.error) throw new Error(scoreHistoryRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (auditsRes.error) throw new Error(auditsRes.error.message);
  if (businessAuditsRes.error) throw new Error(businessAuditsRes.error.message);

  return {
    profiles: (profilesRes.data ?? []) as ProfileRow[],
    businesses: (businessesRes.data ?? []) as BusinessRow[],
    latestScores: (scoresRes.data ?? []) as ScoreRow[],
    scoreHistory: (scoreHistoryRes.data ?? []) as ScoreHistoryRow[],
    tasks: tasksRes.data ?? [],
    audits: (auditsRes.data ?? []) as AuditAggRow[],
    businessAudits: (businessAuditsRes.data ?? []) as BusinessAuditRow[],
  };
}

function sortBusinessesForDisplay(
  businesses: BusinessRow[],
  scoreByBusiness: Map<string, ScoreRow>
): AdminUserBusinessPreview[] {
  return [...businesses]
    .sort((a, b) => {
      const aConnected = Boolean(a.gbp_location_id);
      const bConnected = Boolean(b.gbp_location_id);
      if (aConnected !== bConnected) return aConnected ? -1 : 1;
      if (a.onboarding_complete !== b.onboarding_complete) {
        return a.onboarding_complete ? -1 : 1;
      }
      const aScore = scoreByBusiness.get(a.id)?.overall ?? -1;
      const bScore = scoreByBusiness.get(b.id)?.overall ?? -1;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    })
    .map((business) => ({
      id: business.id,
      name: business.name,
      location: formatLocation(business.location),
      score: scoreByBusiness.get(business.id)?.overall ?? null,
      gbpConnected: Boolean(business.gbp_location_id),
      onboardingComplete: business.onboarding_complete,
    }));
}

function buildUserSummaries(data: Awaited<ReturnType<typeof fetchAdminBaseData>>): AdminUserSummary[] {
  const businessesByUser = new Map<string, BusinessRow[]>();
  for (const business of data.businesses) {
    const list = businessesByUser.get(business.user_id) ?? [];
    list.push(business);
    businessesByUser.set(business.user_id, list);
  }

  const scoreByBusiness = new Map(data.latestScores.map((row) => [row.business_id, row]));
  const score7dByBusiness = new Map(
    data.scoreHistory.map((row) => [row.business_id, row.overall])
  );

  const taskCounts = new Map<string, { pending: number; completed: number; failed: number }>();
  for (const task of data.tasks) {
    const current = taskCounts.get(task.user_id) ?? { pending: 0, completed: 0, failed: 0 };
    if (task.status === "pending_approval") current.pending += 1;
    if (task.status === "completed") current.completed += 1;
    if (task.status === "failed") current.failed += 1;
    taskCounts.set(task.user_id, current);
  }

  const lastAuditByUser = new Map<string, string>();
  for (const audit of data.audits) {
    if (!lastAuditByUser.has(audit.user_id)) {
      lastAuditByUser.set(audit.user_id, audit.completed_at);
    }
  }

  return data.profiles.map((profile) => {
    const businesses = businessesByUser.get(profile.id) ?? [];
    const onboarded = businesses.filter((b) => b.onboarding_complete);
    const gbpConnected = businesses.filter((b) => Boolean(b.gbp_location_id));

    const businessScores = businesses
      .map((b) => scoreByBusiness.get(b.id)?.overall)
      .filter((score): score is number => typeof score === "number");

    const avgScore =
      businessScores.length > 0
        ? Math.round(businessScores.reduce((sum, score) => sum + score, 0) / businessScores.length)
        : null;

    const grade = avgScore !== null ? gradeFromScore(avgScore) : null;

    const scoreDeltas = businesses
      .map((b) => {
        const current = scoreByBusiness.get(b.id)?.overall;
        const prior = score7dByBusiness.get(b.id);
        if (typeof current !== "number" || typeof prior !== "number") return null;
        return current - prior;
      })
      .filter((delta): delta is number => delta !== null);

    const scoreDelta7d =
      scoreDeltas.length > 0
        ? Math.round(scoreDeltas.reduce((sum, delta) => sum + delta, 0) / scoreDeltas.length)
        : null;

    const taskCount = taskCounts.get(profile.id) ?? { pending: 0, completed: 0, failed: 0 };
    const lastAuditAt = lastAuditByUser.get(profile.id) ?? null;
    const lastActivityAt = lastAuditAt;
    const businessPreviews = sortBusinessesForDisplay(businesses, scoreByBusiness);

    return {
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      createdAt: profile.created_at,
      businessCount: businesses.length,
      onboardedCount: onboarded.length,
      gbpConnectedCount: gbpConnected.length,
      businesses: businessPreviews,
      avgScore,
      grade,
      scoreDelta7d,
      pendingTasks: taskCount.pending,
      completedTasks: taskCount.completed,
      failedTasks: taskCount.failed,
      lastAuditAt,
      lastActivityAt,
      status: deriveUserStatus({
        onboardedCount: onboarded.length,
        businessCount: businesses.length,
        grade,
        lastActivityAt,
      }),
      dominantAutopilotMode: dominantMode(businesses.map((b) => b.autopilot_mode)),
    };
  });
}

export interface ListAdminUsersOptions {
  q?: string;
  grade?: HealthGrade | "all";
  status?: UserStatus | "all";
  page?: number;
  pageSize?: number;
}

export async function listAdminUsers(options: ListAdminUsersOptions = {}): Promise<AdminUserListResult> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? PAGE_SIZE_DEFAULT));
  const data = await fetchAdminBaseData();
  let users = buildUserSummaries(data);

  const q = options.q?.trim().toLowerCase();
  if (q) {
    users = users.filter(
      (user) =>
        user.email?.toLowerCase().includes(q) ||
        user.fullName?.toLowerCase().includes(q) ||
        user.userId.toLowerCase().includes(q) ||
        user.businesses.some(
          (business) =>
            business.name.toLowerCase().includes(q) ||
            business.location.toLowerCase().includes(q)
        )
    );
  }

  if (options.grade && options.grade !== "all") {
    users = users.filter((user) => user.grade === options.grade);
  }

  if (options.status && options.status !== "all") {
    users = users.filter((user) => user.status === options.status);
  }

  const total = users.length;
  const start = (page - 1) * pageSize;
  const paged = users.slice(start, start + pageSize);

  return { users: paged, total, page, pageSize };
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const data = await fetchAdminBaseData();
  const summary = buildUserSummaries(data).find((user) => user.userId === userId);
  if (!summary) return null;

  const businesses = data.businesses.filter((b) => b.user_id === userId);
  const scoreByBusiness = new Map(data.latestScores.map((row) => [row.business_id, row]));

  const taskCountsByBusiness = new Map<string, { pending: number; completed: number }>();
  for (const task of data.tasks) {
    if (task.user_id !== userId) continue;
    const current = taskCountsByBusiness.get(task.business_id) ?? { pending: 0, completed: 0 };
    if (task.status === "pending_approval") current.pending += 1;
    if (task.status === "completed") current.completed += 1;
    taskCountsByBusiness.set(task.business_id, current);
  }

  const lastAuditByBusiness = new Map<string, string>();
  for (const audit of data.businessAudits) {
    if (!lastAuditByBusiness.has(audit.business_id)) {
      lastAuditByBusiness.set(audit.business_id, audit.completed_at);
    }
  }

  const businessSummaries: AdminBusinessSummary[] = businesses.map((business) => {
    const scoreRow = scoreByBusiness.get(business.id);
    const score = scoreRow?.overall ?? null;
    const counts = taskCountsByBusiness.get(business.id) ?? { pending: 0, completed: 0 };

    return {
      id: business.id,
      slug: business.slug,
      name: business.name,
      industry: business.industry,
      location: formatLocation(business.location),
      onboardingComplete: business.onboarding_complete,
      gbpConnected: Boolean(business.gbp_location_id),
      autopilotMode: business.autopilot_mode,
      score,
      grade: score !== null ? gradeFromScore(score) : null,
      scoreDate: scoreRow?.score_date ?? null,
      pendingTasks: counts.pending,
      completedTasks: counts.completed,
      lastAuditAt: lastAuditByBusiness.get(business.id) ?? null,
    };
  });

  const businessNameById = new Map(businesses.map((b) => [b.id, b.name]));
  const recentTasks: AdminTaskSummary[] = data.tasks
    .filter((task) => task.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((task) => ({
      id: task.id,
      businessId: task.business_id,
      businessName: businessNameById.get(task.business_id) ?? "Unknown",
      title: task.title,
      taskType: task.task_type,
      priority: task.priority,
      status: task.status,
      createdAt: task.created_at,
      completedAt: task.completed_at,
    }));

  return {
    ...summary,
    businesses: businessSummaries,
    recentTasks,
  };
}

export async function getAllUserSummaries(): Promise<AdminUserSummary[]> {
  const data = await fetchAdminBaseData();
  return buildUserSummaries(data);
}
