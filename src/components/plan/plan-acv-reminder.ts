/** Session flag: user closed the ACV reminder modal for this visit. */
export function planAcvReminderSessionKey(businessId: string): string {
  return `plan-acv-reminder-dismissed:${businessId}`;
}

/** localStorage: snooze the ACV reminder until this timestamp (ms). */
export function planAcvReminderSnoozeKey(businessId: string): string {
  return `plan-acv-reminder-snooze-until:${businessId}`;
}

export const PLAN_ACV_REMINDER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isPlanAcvReminderSnoozed(businessId: string, now = Date.now()): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(planAcvReminderSnoozeKey(businessId));
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function snoozePlanAcvReminder(
  businessId: string,
  snoozeMs = PLAN_ACV_REMINDER_SNOOZE_MS,
  now = Date.now()
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(planAcvReminderSnoozeKey(businessId), String(now + snoozeMs));
  } catch {
    // ignore quota / private mode
  }
}

export function dismissPlanAcvReminderForSession(businessId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(planAcvReminderSessionKey(businessId), "1");
  } catch {
    // ignore
  }
}

export function isPlanAcvReminderDismissedForSession(businessId: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(planAcvReminderSessionKey(businessId)) === "1";
  } catch {
    return false;
  }
}

export function shouldShowPlanAcvReminder(options: {
  businessId?: string | null;
  avgCustomerValue?: number | null;
  now?: number;
}): boolean {
  if (!options.businessId) return false;
  if (options.avgCustomerValue != null && options.avgCustomerValue > 0) return false;
  if (isPlanAcvReminderSnoozed(options.businessId, options.now)) return false;
  if (isPlanAcvReminderDismissedForSession(options.businessId)) return false;
  return true;
}
