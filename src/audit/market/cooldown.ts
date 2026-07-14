export interface ManualRefreshCooldown {
  canRefresh: boolean;
  availableAt: string | null;
  remainingMs: number;
}

export function manualRefreshCooldown(
  lastRefreshAt: string | null | undefined,
  now: Date,
  cooldownDays: number
): ManualRefreshCooldown {
  if (!lastRefreshAt) {
    return { canRefresh: true, availableAt: null, remainingMs: 0 };
  }
  const availableAt = new Date(lastRefreshAt);
  availableAt.setUTCDate(availableAt.getUTCDate() + cooldownDays);
  const remainingMs = Math.max(0, availableAt.getTime() - now.getTime());
  return {
    canRefresh: remainingMs === 0,
    availableAt: availableAt.toISOString(),
    remainingMs,
  };
}
