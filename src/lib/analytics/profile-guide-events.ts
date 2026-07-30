/**
 * Profile Guide analytics — fire-and-forget view/click events for public pages.
 */

export type ProfileGuideAnalyticsEventName = "profile_guide_view" | "profile_guide_click";

export interface ProfileGuideAnalyticsEvent {
  name: ProfileGuideAnalyticsEventName;
  guideId: string;
  linkId?: string | null;
  source?: string | null;
  occurredAt?: string;
}

export function trackProfileGuideEvent(event: ProfileGuideAnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    ...event,
    referrer: document.referrer || null,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/profile-guide/events", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    // fall through
  }

  void fetch("/api/profile-guide/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics must never surface errors to users.
  });
}
