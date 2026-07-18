import type { Phase1AuditPayload } from "../types";

/** Which profile-action channel is most underperforming vs simple view baselines. */
export type ConversionChannelBias = "calls" | "directions" | "website" | "balanced";

/** Relative target action rates (fraction of profile views). */
const CHANNEL_TARGETS = {
  calls: 0.02,
  directions: 0.025,
  website: 0.015,
} as const;

/**
 * Prefer conversion levers that match the weakest action channel.
 * Returns balanced when traffic is too thin or all channels look similar.
 */
export function resolveConversionChannelBias(
  audit: Phase1AuditPayload
): ConversionChannelBias {
  const views = audit.gbp.performance.profileViews;
  if (views < 40) return "balanced";

  const calls = audit.gbp.performance.calls / views;
  const directions = audit.gbp.performance.directionRequests / views;
  const website = audit.gbp.performance.websiteClicks / views;

  const deficits: Array<{ channel: ConversionChannelBias; deficit: number }> = [
    { channel: "calls", deficit: CHANNEL_TARGETS.calls - calls },
    { channel: "directions", deficit: CHANNEL_TARGETS.directions - directions },
    { channel: "website", deficit: CHANNEL_TARGETS.website - website },
  ];

  deficits.sort((a, b) => b.deficit - a.deficit);
  const top = deficits[0];
  const second = deficits[1];
  if (!top || top.deficit <= 0) return "balanced";
  // Require a clear winner so tiny noise doesn't reshuffle NBA.
  if (second && top.deficit - second.deficit < 0.005) return "balanced";
  return top.channel;
}

/**
 * Ordered conversion-family plan steps for the dominant channel gap.
 * Hours (12) can reinforce directions but is not a CONVERSION_PLAN_STEPS member.
 */
export function conversionLeversForChannel(
  bias: ConversionChannelBias
): number[] {
  switch (bias) {
    case "calls":
      return [15, 8, 11, 13];
    case "directions":
      return [15, 13, 12, 8];
    case "website":
      return [15, 13, 8, 11];
    default:
      return [15, 8, 13, 11];
  }
}
