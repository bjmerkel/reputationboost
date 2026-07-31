import type { HealthGrade } from "@/audit/types";
import type { AdminUserSummary, UserStatus } from "@/lib/admin/types";

export type ChurnRiskLevel = "low" | "medium" | "high";

export interface UserHealthInput {
  avgScore: number | null;
  scoreDelta7d: number | null;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  lastAuditAt: string | null;
  onboardedCount: number;
  businessCount: number;
  gbpConnectedCount: number;
  grade: HealthGrade | null;
}

export interface UserHealthMetrics {
  healthIndex: number | null;
  churnRisk: number;
  churnRiskLevel: ChurnRiskLevel;
  healthFactors: string[];
  churnSignals: string[];
}

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function recencyScore(lastAuditAt: string | null): number {
  const days = daysSince(lastAuditAt);
  if (days <= 3) return 100;
  if (days <= 7) return 85;
  if (days <= 14) return 65;
  if (days <= 21) return 45;
  if (days <= 30) return 25;
  return 10;
}

function taskVelocityScore(input: UserHealthInput): number {
  const total = input.completedTasks + input.pendingTasks + input.failedTasks;
  if (total === 0) return input.onboardedCount > 0 ? 30 : 50;
  const completionRate = input.completedTasks / total;
  const pendingPenalty = Math.min(input.pendingTasks / 20, 0.4);
  return Math.round(Math.max(0, Math.min(100, completionRate * 100 * (1 - pendingPenalty))));
}

function scoreTrendScore(scoreDelta7d: number | null): number {
  if (scoreDelta7d === null) return 50;
  if (scoreDelta7d >= 10) return 100;
  if (scoreDelta7d >= 5) return 85;
  if (scoreDelta7d >= 0) return 70;
  if (scoreDelta7d >= -5) return 45;
  if (scoreDelta7d >= -10) return 25;
  return 10;
}

function connectionScore(input: UserHealthInput): number {
  if (input.onboardedCount === 0) return 40;
  if (input.gbpConnectedCount === 0) return 20;
  const ratio = input.gbpConnectedCount / Math.max(input.onboardedCount, 1);
  return Math.round(50 + ratio * 50);
}

export function computeUserHealthMetrics(input: UserHealthInput): UserHealthMetrics {
  const healthFactors: string[] = [];
  const churnSignals: string[] = [];
  let churnRisk = 0;

  if (input.scoreDelta7d !== null && input.scoreDelta7d <= -10) {
    churnRisk += 30;
    churnSignals.push(`Score down ${Math.abs(input.scoreDelta7d)} pts (7d)`);
  } else if (input.scoreDelta7d !== null && input.scoreDelta7d <= -5) {
    churnRisk += 15;
    churnSignals.push(`Score slipping (${input.scoreDelta7d} pts, 7d)`);
  }

  const inactiveDays = daysSince(input.lastAuditAt);
  if (inactiveDays > 21) {
    churnRisk += 25;
    churnSignals.push(`No audit in ${inactiveDays}d`);
  } else if (inactiveDays > 14) {
    churnRisk += 12;
    churnSignals.push(`Quiet for ${inactiveDays}d`);
  }

  if (input.onboardedCount > 0 && input.gbpConnectedCount < input.onboardedCount) {
    churnRisk += 20;
    churnSignals.push("GBP disconnected on one or more locations");
  }

  if (input.onboardedCount > 0 && input.completedTasks === 0 && input.pendingTasks > 0) {
    churnRisk += 15;
    churnSignals.push("Tasks pending but none completed");
  } else if (input.pendingTasks > 15) {
    churnRisk += 10;
    churnSignals.push(`Large approval backlog (${input.pendingTasks})`);
  }

  if (input.grade === "urgent") {
    churnRisk += 10;
    churnSignals.push("Urgent Reputation Boost Score");
  }

  if (input.failedTasks > 10) {
    churnRisk += 10;
    churnSignals.push(`${input.failedTasks} failed tasks`);
  }

  churnRisk = Math.min(100, churnRisk);

  let healthIndex: number | null = null;
  if (input.avgScore !== null || input.onboardedCount > 0) {
    const scoreComponent = input.avgScore ?? 45;
    const trendComponent = scoreTrendScore(input.scoreDelta7d);
    const taskComponent = taskVelocityScore(input);
    const recencyComponent = recencyScore(input.lastAuditAt);
    const connectionComponent = connectionScore(input);

    healthIndex = Math.round(
      scoreComponent * 0.35 +
        trendComponent * 0.2 +
        taskComponent * 0.2 +
        recencyComponent * 0.15 +
        connectionComponent * 0.1
    );

    if (scoreComponent >= 70) healthFactors.push("Strong score");
    if (input.scoreDelta7d !== null && input.scoreDelta7d >= 5) healthFactors.push("Improving trend");
    if (taskComponent >= 70) healthFactors.push("Active task execution");
    if (recencyComponent >= 85) healthFactors.push("Recent audit activity");
    if (connectionComponent >= 90) healthFactors.push("GBP fully connected");
    if (healthFactors.length === 0) healthFactors.push("Needs engagement");
  }

  const churnRiskLevel: ChurnRiskLevel =
    churnRisk >= 60 ? "high" : churnRisk >= 30 ? "medium" : "low";

  return {
    healthIndex,
    churnRisk,
    churnRiskLevel,
    healthFactors,
    churnSignals,
  };
}

export function churnRiskLevelLabel(level: ChurnRiskLevel): string {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

export function healthIndexTone(
  index: number | null
): "success" | "warning" | "danger" | "default" {
  if (index === null) return "default";
  if (index >= 70) return "success";
  if (index >= 45) return "warning";
  return "danger";
}
