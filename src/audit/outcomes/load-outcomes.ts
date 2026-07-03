import type { FullAuditPayload } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { buildAttributionSummary, listActionAttributionsForUser } from "@/audit/storage-attribution";
import { getBusinessIdForSlug } from "@/audit/storage-supabase";
import { createClient } from "@/lib/supabase/server";
import type { IneffectiveAction, OutcomesContext, ProvenWin } from "./types";

const LOOKBACK_DAYS = 90;

function isProvenWin(attribution: ActionAttribution): boolean {
  if (attribution.preliminary) return false;
  const rankImproved =
    attribution.rankBefore != null &&
    attribution.rankAfter != null &&
    attribution.rankAfter < attribution.rankBefore;
  const engagementUp =
    (attribution.callsDelta ?? 0) > 0 ||
    (attribution.directionsDelta ?? 0) > 0 ||
    (attribution.websiteClicksDelta ?? 0) > 0;
  return rankImproved || engagementUp;
}

function isIneffective(attribution: ActionAttribution): boolean {
  if (attribution.preliminary) return false;
  const rankFlatOrWorse =
    attribution.rankBefore != null &&
    attribution.rankAfter != null &&
    attribution.rankAfter >= attribution.rankBefore;
  const engagementFlat =
    (attribution.callsDelta ?? 0) <= 0 &&
    (attribution.directionsDelta ?? 0) <= 0 &&
    (attribution.websiteClicksDelta ?? 0) <= 0;
  return rankFlatOrWorse && engagementFlat;
}

function toProvenWin(attribution: ActionAttribution): ProvenWin {
  return {
    taskType: attribution.taskType,
    title: attribution.title,
    primaryKeyword: attribution.primaryKeyword,
    rankBefore: attribution.rankBefore,
    rankAfter: attribution.rankAfter,
    callsDelta: attribution.callsDelta ?? 0,
    directionsDelta: attribution.directionsDelta ?? 0,
    estimatedRevenue: attribution.estimatedRevenue,
    narrative: attribution.narrative,
  };
}

function buildCorrelations(wins: ProvenWin[]): string[] {
  const correlations: string[] = [];

  const postWins = wins.filter((w) => w.taskType === "google_post");
  if (postWins.length >= 2) {
    const keywords = [
      ...new Set(postWins.map((w) => w.primaryKeyword).filter(Boolean) as string[]),
    ];
    if (keywords.length > 0) {
      correlations.push(
        `Google Posts mentioning ${keywords.slice(0, 3).join(", ")} correlated with rank or engagement gains`
      );
    } else {
      correlations.push("Regular Google Posts correlated with measurable engagement lifts");
    }
  }

  const reviewWins = wins.filter((w) => w.taskType === "review_response");
  if (reviewWins.length > 0 && reviewWins.some((w) => w.callsDelta > 0)) {
    correlations.push("Timely review responses correlated with more call clicks");
  }

  const descriptionWins = wins.filter((w) => w.taskType === "gbp_description");
  if (descriptionWins.length > 0) {
    correlations.push("GBP description updates coincided with broader keyword visibility gains");
  }

  return correlations;
}

function topKeywordsFromWins(wins: ProvenWin[]): string[] {
  const scores = new Map<string, number>();
  for (const win of wins) {
    if (!win.primaryKeyword) continue;
    const score =
      (win.estimatedRevenue ?? 0) +
      win.callsDelta * 10 +
      win.directionsDelta * 8 +
      (win.rankBefore != null && win.rankAfter != null
        ? Math.max(0, win.rankBefore - win.rankAfter) * 5
        : 0);
    scores.set(win.primaryKeyword, (scores.get(win.primaryKeyword) ?? 0) + score);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([keyword]) => keyword);
}

export async function loadOutcomesForStrategy(
  userId: string,
  clientSlug: string,
  priorAudit: FullAuditPayload | null
): Promise<OutcomesContext | null> {
  const businessId = await getBusinessIdForSlug(userId, clientSlug);
  if (!businessId) return null;

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_DAYS);

  const [attributions, summary, taskStats] = await Promise.all([
    listActionAttributionsForUser(userId, clientSlug, 50),
    buildAttributionSummary(userId, clientSlug, 30),
    loadExecutionTaskStats(userId, businessId, cutoff),
  ]);

  const recentAttributions = attributions.filter(
    (a) => new Date(a.publishedAt) >= cutoff
  );

  if (
    recentAttributions.length === 0 &&
    taskStats.completed === 0 &&
    taskStats.skipped === 0 &&
    !priorAudit?.strategy?.kpiTargets?.length
  ) {
    return null;
  }

  const provenWins = recentAttributions
    .filter(isProvenWin)
    .sort((a, b) => (b.estimatedRevenue ?? 0) - (a.estimatedRevenue ?? 0))
    .slice(0, 8)
    .map(toProvenWin);

  const whatDidntWork: IneffectiveAction[] = recentAttributions
    .filter(isIneffective)
    .slice(0, 5)
    .map((a) => ({
      taskType: a.taskType,
      title: a.title,
      primaryKeyword: a.primaryKeyword,
      callsDelta: a.callsDelta ?? 0,
      rankDelta: a.rankDelta,
    }));

  return {
    provenWins,
    whatDidntWork,
    correlations: buildCorrelations(provenWins),
    monthlyEstimatedRevenue: summary.totalEstimatedRevenue,
    tasksCompleted: taskStats.completed,
    tasksSkipped: taskStats.skipped,
    priorKpiTargets: priorAudit?.strategy?.kpiTargets ?? [],
    completedTaskTypes: taskStats.completedByType,
    topPerformingKeywords: topKeywordsFromWins(provenWins),
  };
}

async function loadExecutionTaskStats(
  userId: string,
  businessId: string,
  since: Date
): Promise<{
  completed: number;
  skipped: number;
  completedByType: Record<string, number>;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("execution_tasks")
    .select("task_type, status, completed_at, created_at")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .gte("created_at", since.toISOString());

  let completed = 0;
  let skipped = 0;
  const completedByType: Record<string, number> = {};

  for (const row of data ?? []) {
    const status = row.status as string;
    const taskType = row.task_type as string;

    if (status === "completed") {
      completed += 1;
      completedByType[taskType] = (completedByType[taskType] ?? 0) + 1;
    } else if (status === "pending_approval" || status === "approved") {
      skipped += 1;
    }
  }

  return { completed, skipped, completedByType };
}
