import { createAdminClient } from "@/lib/supabase/admin";
import { userMatchesSegment } from "@/lib/admin/segments";
import { getAllUserSummaries } from "@/lib/admin/users";
import type { AdminUserSummary } from "@/lib/admin/types";

export type OutreachPriority = "critical" | "high" | "medium";

export interface OutreachQueueItem {
  user: AdminUserSummary;
  priority: OutreachPriority;
  reason: string;
  segments: string[];
  lastNoteAt: string | null;
  daysSinceContact: number | null;
}

export interface AdminOutreachData {
  queue: OutreachQueueItem[];
  total: number;
  criticalCount: number;
  highCount: number;
  neverContacted: number;
}

function derivePriority(user: AdminUserSummary): OutreachPriority {
  if (user.churnRiskLevel === "high" || user.grade === "urgent") return "critical";
  if (user.churnRiskLevel === "medium" || user.churnRisk >= 40) return "high";
  return "medium";
}

function deriveReason(user: AdminUserSummary): string {
  if (user.churnSignals[0]) return user.churnSignals[0];
  if (user.healthFactors.length > 0) {
    const riskFactor = user.healthFactors.find((factor) => factor.startsWith("−"));
    if (riskFactor) return riskFactor;
  }
  if (user.onboardedCount > 0 && user.gbpConnectedCount < user.onboardedCount) {
    return "GBP disconnected on one or more locations";
  }
  if ((user.scoreDelta7d ?? 0) <= -10) {
    return `Score dropped ${Math.abs(user.scoreDelta7d ?? 0)} pts in 7 days`;
  }
  if (user.pendingTasks > 10) {
    return `${user.pendingTasks} tasks pending approval`;
  }
  return "Needs proactive check-in";
}

function deriveSegments(user: AdminUserSummary): string[] {
  const segments: string[] = [];
  if (userMatchesSegment(user, "needs_attention")) segments.push("Needs attention");
  if (userMatchesSegment(user, "about_to_churn")) segments.push("About to churn");
  if (userMatchesSegment(user, "onboarded_stuck")) segments.push("Onboarded but stuck");
  if (userMatchesSegment(user, "high_backlog")) segments.push("High backlog");
  return segments;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function priorityRank(priority: OutreachPriority): number {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  return 2;
}

function shouldIncludeInQueue(user: AdminUserSummary): boolean {
  return (
    user.churnRiskLevel !== "low" ||
    userMatchesSegment(user, "needs_attention") ||
    userMatchesSegment(user, "about_to_churn") ||
    userMatchesSegment(user, "onboarded_stuck") ||
    user.pendingTasks > 10 ||
    (user.onboardedCount > 0 && user.gbpConnectedCount < user.onboardedCount)
  );
}

export async function getAdminOutreachData(): Promise<AdminOutreachData> {
  const [users, noteRows] = await Promise.all([
    getAllUserSummaries(),
    fetchLatestNoteByUser(),
  ]);

  const queue: OutreachQueueItem[] = users
    .filter(shouldIncludeInQueue)
    .map((user) => {
      const lastNoteAt = noteRows.get(user.userId) ?? null;
      return {
        user,
        priority: derivePriority(user),
        reason: deriveReason(user),
        segments: deriveSegments(user),
        lastNoteAt,
        daysSinceContact: daysSince(lastNoteAt),
      };
    })
    .sort((a, b) => {
      const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return b.user.churnRisk - a.user.churnRisk;
    });

  return {
    queue,
    total: queue.length,
    criticalCount: queue.filter((item) => item.priority === "critical").length,
    highCount: queue.filter((item) => item.priority === "high").length,
    neverContacted: queue.filter((item) => !item.lastNoteAt).length,
  };
}

async function fetchLatestNoteByUser(): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("admin_notes")
    .select("user_id, created_at")
    .order("created_at", { ascending: false });

  if (error) return new Map();

  const latest = new Map<string, string>();
  for (const row of data ?? []) {
    const userId = row.user_id as string;
    if (!latest.has(userId)) {
      latest.set(userId, row.created_at as string);
    }
  }
  return latest;
}
