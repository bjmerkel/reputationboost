import type { Phase1AuditPayload } from "../types";

/** Which profile-action channel is most underperforming vs simple view baselines. */
export type ConversionChannelBias = "calls" | "directions" | "website" | "balanced";

export interface ConversionChannelTargets {
  calls: number;
  directions: number;
  website: number;
}

export interface ConversionChannelOptions {
  /** User override when a business knows which channel drives value. */
  preferredChannel?: ConversionChannelBias;
}

/** Default relative target action rates (fraction of profile views). */
const DEFAULT_CHANNEL_TARGETS: ConversionChannelTargets = {
  calls: 0.02,
  directions: 0.025,
  website: 0.015,
};

/** Category-aware benchmarks — home services skew calls; retail skews directions. */
export function resolveCategoryChannelTargets(
  audit: Phase1AuditPayload
): ConversionChannelTargets {
  const category = (audit.gbp.identity.primaryCategory || audit.clientName || "")
    .toLowerCase();

  if (/restaurant|retail|store|shop|salon|spa|cafe|bakery|boutique/.test(category)) {
    return { calls: 0.015, directions: 0.035, website: 0.02 };
  }

  if (isHomeServiceCategory(audit)) {
    return { calls: 0.03, directions: 0.015, website: 0.012 };
  }

  return DEFAULT_CHANNEL_TARGETS;
}

/** Home-service categories where calls are the primary revenue channel. */
export function isHomeServiceCategory(audit: Phase1AuditPayload): boolean {
  const category = (audit.gbp.identity.primaryCategory || audit.clientName || "")
    .toLowerCase();
  return /plumber|hvac|electric|roof|contractor|repair|lawyer|attorney|dentist|clinic|doctor|mechanic|landscap/.test(
    category
  );
}

/** Pack-presence-adjusted category targets (visible listings convert higher). */
export function resolveEffectiveChannelTargets(
  audit: Phase1AuditPayload
): ConversionChannelTargets {
  const category = resolveCategoryChannelTargets(audit);
  const total = audit.rankings.totalKeywords || audit.rankings.keywords.length;
  const packShare = total > 0 ? audit.rankings.keywordsInPack / total : 0;
  const multiplier = packShare >= 0.5 ? 1.05 : 0.9;
  return {
    calls: category.calls * multiplier,
    directions: category.directions * multiplier,
    website: category.website * multiplier,
  };
}

/**
 * Prefer conversion levers that match the weakest action channel.
 * Returns balanced when traffic is too thin or all channels look similar.
 */
export function resolveConversionChannelBias(
  audit: Phase1AuditPayload,
  options?: ConversionChannelOptions
): ConversionChannelBias {
  const preferred = options?.preferredChannel;
  if (preferred && preferred !== "balanced") {
    return preferred;
  }

  const views = audit.gbp.performance.profileViews;
  if (views < 40) return "balanced";

  const targets = resolveEffectiveChannelTargets(audit);
  const calls = audit.gbp.performance.calls / views;
  const directions = audit.gbp.performance.directionRequests / views;
  const website = audit.gbp.performance.websiteClicks / views;

  const deficits: Array<{ channel: ConversionChannelBias; deficit: number }> = [
    { channel: "calls", deficit: targets.calls - calls },
    { channel: "directions", deficit: targets.directions - directions },
    { channel: "website", deficit: targets.website - website },
  ];

  deficits.sort((a, b) => b.deficit - a.deficit);
  const top = deficits[0];
  const second = deficits[1];
  if (!top || top.deficit <= 0) return "balanced";
  // Looser threshold on thinner traffic so channel bias still activates.
  const winnerThreshold = views < 200 ? 0.0025 : 0.005;
  if (second && top.deficit - second.deficit < winnerThreshold) {
    if (audit.gbp.performance.calls === 0 && views >= 40 && isHomeServiceCategory(audit)) {
      return "calls";
    }
    return "balanced";
  }
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
