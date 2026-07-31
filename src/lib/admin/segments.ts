import type { AdminUserSummary } from "@/lib/admin/types";

export type AdminSegmentId =
  | "onboarded_stuck"
  | "power_users"
  | "about_to_churn"
  | "healthy_improvers"
  | "high_backlog"
  | "needs_attention";

export interface AdminSegment {
  id: AdminSegmentId;
  label: string;
  description: string;
}

export const ADMIN_SEGMENTS: AdminSegment[] = [
  {
    id: "needs_attention",
    label: "Needs attention",
    description: "High churn risk or urgent health index",
  },
  {
    id: "about_to_churn",
    label: "About to churn",
    description: "Score dropped 10+ pts and quiet for 14+ days",
  },
  {
    id: "onboarded_stuck",
    label: "Onboarded but stuck",
    description: "Onboarded, score below 40, no completed tasks",
  },
  {
    id: "high_backlog",
    label: "High backlog",
    description: "More than 10 tasks pending approval",
  },
  {
    id: "power_users",
    label: "Power users",
    description: "Healthy score with strong task completion",
  },
  {
    id: "healthy_improvers",
    label: "Healthy improvers",
    description: "Score up 5+ pts in the last 7 days",
  },
];

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function userMatchesSegment(user: AdminUserSummary, segment: AdminSegmentId): boolean {
  switch (segment) {
    case "needs_attention":
      return user.churnRiskLevel === "high" || (user.healthIndex !== null && user.healthIndex < 40);
    case "about_to_churn":
      return (user.scoreDelta7d ?? 0) <= -10 && daysSince(user.lastAuditAt) >= 14;
    case "onboarded_stuck":
      return (
        user.onboardedCount > 0 &&
        (user.avgScore ?? 0) < 40 &&
        user.completedTasks === 0
      );
    case "high_backlog":
      return user.pendingTasks > 10;
    case "power_users":
      return (
        (user.avgScore ?? 0) >= 70 &&
        user.completedTasks >= 5 &&
        user.onboardedCount > 0
      );
    case "healthy_improvers":
      return (user.scoreDelta7d ?? 0) >= 5 && (user.avgScore ?? 0) >= 55;
    default:
      return false;
  }
}

export function countUsersInSegment(
  users: AdminUserSummary[],
  segment: AdminSegmentId
): number {
  return users.filter((user) => userMatchesSegment(user, segment)).length;
}
