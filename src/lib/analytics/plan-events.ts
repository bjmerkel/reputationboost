/**
 * Plan tab product analytics — lightweight fire-and-forget events for soak
 * validation and post-launch monitoring (Phase 5.4).
 */

export type PlanAnalyticsEventName =
  | "plan_nba_click"
  | "plan_keyword_playbook_cta"
  | "plan_publish_success"
  | "plan_reconcile_live";

export interface PlanAnalyticsEvent {
  name: PlanAnalyticsEventName;
  businessId?: string | null;
  auditId?: string | null;
  stepNumber?: number | null;
  keyword?: string | null;
  taskId?: string | null;
  taskType?: string | null;
  /** Optional extra context (kept small — no PII). */
  meta?: Record<string, string | number | boolean | null>;
  occurredAt?: string;
}

/** Server-side structured log for plan analytics (queryable in Vercel/host logs). */
export function logPlanEvent(event: PlanAnalyticsEvent): void {
  const payload = {
    type: "plan_analytics",
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  };
  console.info(JSON.stringify(payload));
}

/**
 * Client-side fire-and-forget tracker. Never blocks UX on analytics failures.
 */
export function trackPlanEvent(event: PlanAnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/plan", blob);
      return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch("/api/analytics/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics must never surface errors to users.
  });
}
