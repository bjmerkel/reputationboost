/**
 * When this step's recommendation was produced.
 * Prefers the newest open task timestamp (including draft refreshes),
 * then plan reconcile / strategy generation / audit completion.
 */
export function resolveRecommendationTimestamp(input: {
  tasks: Array<{
    status: string;
    createdAt: string;
    payload?: Record<string, unknown>;
  }>;
  planReconciledAt?: string | null;
  strategyGeneratedAt?: string | null;
  auditCompletedAt?: string | null;
}): string | undefined {
  const candidates: number[] = [];

  for (const task of input.tasks) {
    if (task.status === "completed" || task.status === "rejected") continue;

    const created = Date.parse(task.createdAt);
    if (!Number.isNaN(created)) candidates.push(created);

    for (const key of [
      "recommendedAt",
      "descriptionDraftRefreshedAt",
      "reviewReplyDraftRefreshedAt",
    ] as const) {
      const value = task.payload?.[key];
      if (typeof value !== "string") continue;
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) candidates.push(parsed);
    }
  }

  if (candidates.length > 0) {
    return new Date(Math.max(...candidates)).toISOString();
  }

  for (const fallback of [
    input.planReconciledAt,
    input.strategyGeneratedAt,
    input.auditCompletedAt,
  ]) {
    if (!fallback) continue;
    const parsed = Date.parse(fallback);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }

  return undefined;
}
