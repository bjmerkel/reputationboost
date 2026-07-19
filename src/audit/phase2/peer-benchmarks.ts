import type { Phase1AuditPayload } from "../types";
import {
  resolveEffectiveChannelTargets,
  type ConversionChannelTargets,
} from "./conversion-channel";

export type PeerBenchmarkConfidence = "peer" | "category" | "default";

export interface PeerActionBenchmarks {
  callsPerView: number;
  directionsPerView: number;
  websitePerView: number;
  /** Median pack-leader review count across tracked keywords (when available). */
  reviewCountP50: number;
  /** Combined action-rate target (calls + directions + website) as a % of views. */
  actionRateTargetPct: number;
  confidence: PeerBenchmarkConfidence;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Peer-aware conversion targets. Uses pack-leader review medians when present and
 * adjusts category defaults by pack presence (visible listings should convert higher).
 */
export function buildPeerActionBenchmarks(audit: Phase1AuditPayload): PeerActionBenchmarks {
  const effective = resolveEffectiveChannelTargets(audit);
  const leaders = audit.rankings.keywords
    .map((kw) => kw.packLeaderReviewCount)
    .filter((count) => count > 0);
  const reviewCountP50 = median(leaders);
  const hasPeerReviewData = leaders.length >= 2;

  const callsPerView = effective.calls;
  const directionsPerView = effective.directions;
  const websitePerView = effective.website;
  const actionRateTargetPct =
    Math.round((callsPerView + directionsPerView + websitePerView) * 1000) / 10;

  return {
    callsPerView,
    directionsPerView,
    websitePerView,
    reviewCountP50,
    actionRateTargetPct,
    confidence: hasPeerReviewData ? "peer" : "category",
  };
}

/** Channel targets for conversion bias — peer-adjusted when pack data exists. */
export function resolvePeerChannelTargets(audit: Phase1AuditPayload): ConversionChannelTargets {
  return resolveEffectiveChannelTargets(audit);
}

/**
 * Weak action-rate threshold (%). At least 3%, or half the peer/category combined target.
 */
export function resolveWeakActionRateThresholdPct(audit: Phase1AuditPayload): number {
  const peer = buildPeerActionBenchmarks(audit);
  const fromPeer = Math.round(peer.actionRateTargetPct * 50) / 100;
  return Math.max(3, fromPeer);
}

/** Impression × review-gap opportunity score for outside-pack keyword ordering. */
export function keywordReviewOpportunityScore(
  impressions: number,
  reviewGap: number
): number {
  if (impressions <= 0 || reviewGap <= 0) return 0;
  return (impressions * reviewGap) / 100;
}
