import type { AdminOverview, AdminUserSummary } from "@/lib/admin/types";

export type AdminAlertSeverity = "critical" | "warning" | "success" | "info";

export interface AdminAlert {
  id: string;
  severity: AdminAlertSeverity;
  title: string;
  detail: string;
  href: string;
  userId?: string;
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function userLabel(user: AdminUserSummary): string {
  return user.fullName || user.email || user.businesses[0]?.name || "User";
}

export function buildAdminAlerts(
  users: AdminUserSummary[],
  overview: AdminOverview
): AdminAlert[] {
  const alerts: AdminAlert[] = [];

  if (overview.lastIngest?.errorCount) {
    alerts.push({
      id: "ingest-errors",
      severity: "critical",
      title: "Nightly ingest errors",
      detail: `${overview.lastIngest.errorCount} error(s) in the last ingest run`,
      href: "/admin/operations",
    });
  }

  if (overview.lastIngest?.status === "failed") {
    alerts.push({
      id: "ingest-failed",
      severity: "critical",
      title: "Nightly ingest failed",
      detail: "Last ingest run did not complete successfully",
      href: "/admin/operations",
    });
  }

  for (const user of users) {
    if (user.onboardedCount > 0 && user.gbpConnectedCount < user.onboardedCount) {
      alerts.push({
        id: `gbp-disconnected-${user.userId}`,
        severity: "critical",
        title: "GBP disconnected",
        detail: `${userLabel(user)} — ${user.onboardedCount - user.gbpConnectedCount} location(s) missing GBP`,
        href: `/admin/users/${user.userId}`,
        userId: user.userId,
      });
    }

    if ((user.scoreDelta7d ?? 0) <= -10) {
      alerts.push({
        id: `score-drop-${user.userId}`,
        severity: "warning",
        title: "Score dropped sharply",
        detail: `${userLabel(user)} — ${user.scoreDelta7d} pts in 7 days`,
        href: `/admin/users/${user.userId}`,
        userId: user.userId,
      });
    }

    if (user.onboardedCount > 0 && user.completedTasks === 0 && daysSince(user.lastAuditAt) >= 14) {
      alerts.push({
        id: `inactive-${user.userId}`,
        severity: "warning",
        title: "No task activity",
        detail: `${userLabel(user)} — onboarded but zero tasks completed`,
        href: `/admin/users/${user.userId}`,
        userId: user.userId,
      });
    }

    if (user.pendingTasks > 15) {
      alerts.push({
        id: `backlog-${user.userId}`,
        severity: "warning",
        title: "Large approval backlog",
        detail: `${userLabel(user)} — ${user.pendingTasks} tasks pending`,
        href: `/admin/users/${user.userId}`,
        userId: user.userId,
      });
    }

    if ((user.scoreDelta7d ?? 0) >= 5 && (user.avgScore ?? 0) >= 70) {
      alerts.push({
        id: `healthy-${user.userId}`,
        severity: "success",
        title: "Score improving",
        detail: `${userLabel(user)} — now ${user.avgScore} (+${user.scoreDelta7d} pts)`,
        href: `/admin/users/${user.userId}`,
        userId: user.userId,
      });
    }

    if (user.churnRiskLevel === "high") {
      alerts.push({
        id: `churn-${user.userId}`,
        severity: "critical",
        title: "High churn risk",
        detail: `${userLabel(user)} — ${user.churnSignals[0] ?? "Multiple risk signals"}`,
        href: `/admin/users/${user.userId}`,
        userId: user.userId,
      });
    }
  }

  const severityRank: Record<AdminAlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return alerts
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 20);
}
