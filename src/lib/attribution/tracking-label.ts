import type { ActionAttribution } from "@/audit/types/timeseries";

const MS_PER_DAY = 86_400_000;

type TrackingAttribution = Pick<
  ActionAttribution,
  | "preliminary"
  | "publishedAt"
  | "windowDays"
  | "callsDelta"
  | "directionsDelta"
  | "websiteClicksDelta"
  | "impressionsDelta"
  | "rankDelta"
  | "observedDriverImpact"
  | "keywordsImproved"
>;

export function hasEarlyAttributionSignal(attribution: TrackingAttribution): boolean {
  return (
    (attribution.callsDelta ?? 0) !== 0 ||
    (attribution.directionsDelta ?? 0) !== 0 ||
    (attribution.websiteClicksDelta ?? 0) !== 0 ||
    (attribution.impressionsDelta ?? 0) !== 0 ||
    (attribution.rankDelta != null && attribution.rankDelta !== 0) ||
    (attribution.observedDriverImpact ?? 0) !== 0 ||
    attribution.keywordsImproved > 0
  );
}

export function attributionDaysRemaining(
  attribution: Pick<ActionAttribution, "publishedAt" | "windowDays">,
  now = new Date()
): number {
  const publishedAt = new Date(attribution.publishedAt);
  const daysElapsed = Math.max(
    0,
    Math.floor((now.getTime() - publishedAt.getTime()) / MS_PER_DAY)
  );
  return Math.max(0, attribution.windowDays - daysElapsed);
}

/** Plan/Results UI label while attribution window is still open. */
export function formatAttributionTrackingLabel(
  attribution: TrackingAttribution,
  now = new Date()
): string | null {
  if (!attribution.preliminary) return null;

  const daysRemaining = attributionDaysRemaining(attribution, now);
  const dayLabel = daysRemaining === 1 ? "day" : "days";

  if (hasEarlyAttributionSignal(attribution)) {
    return `Early signal · ${daysRemaining} ${dayLabel} left to confirm`;
  }

  return `Measuring · ${daysRemaining} ${dayLabel} left`;
}
