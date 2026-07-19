/** Cooldown between automatic live Google syncs for manual plan steps. */
export const MANUAL_PLAN_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

export function planManualSyncStorageKey(auditId: string): string {
  return `plan-manual-sync:${auditId}`;
}

export function readLastManualPlanSyncAt(auditId: string): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(planManualSyncStorageKey(auditId));
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function markManualPlanSynced(auditId: string, syncedAt = Date.now()): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(planManualSyncStorageKey(auditId), String(syncedAt));
}

export function shouldAutoLiveSyncManualPlan(options: {
  gbpConnected: boolean;
  hasManualSteps: boolean;
  lastSyncAt?: number | null;
  now?: number;
  cooldownMs?: number;
}): boolean {
  if (!options.gbpConnected || !options.hasManualSteps) return false;
  const lastSyncAt = options.lastSyncAt ?? null;
  if (lastSyncAt == null) return true;
  const now = options.now ?? Date.now();
  return now - lastSyncAt >= (options.cooldownMs ?? MANUAL_PLAN_SYNC_COOLDOWN_MS);
}
