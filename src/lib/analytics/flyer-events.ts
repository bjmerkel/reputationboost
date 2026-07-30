export type FlyerAnalyticsEventName = "flyer_feedback";

export interface FlyerAnalyticsEvent {
  name: FlyerAnalyticsEventName;
  guideId?: string | null;
  businessId?: string | null;
  rating?: -1 | 1 | null;
  historyId?: string | null;
  archetype?: string | null;
  format?: string | null;
  promptVersion?: string | null;
  occurredAt?: string;
}

export function logFlyerEvent(event: FlyerAnalyticsEvent): void {
  const payload = {
    type: "flyer_analytics",
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  };
  console.info(JSON.stringify(payload));
}
