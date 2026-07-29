import type { FullAuditPayload, HealthScores } from "@/audit/types";
import { normalizeHealthScores } from "@/components/audit/ScoreBreakdown";
import {
  computeOverallFromDriverOutcome,
  computeOutcomeIndex,
} from "@/audit/phase2/score-driver-outcome";

/** Nightly score snapshot slice used to align headline + sub-scores in the UI. */
export interface LiveScoreSlice {
  overall: number;
  driverScore?: number;
  outcomeIndex?: number;
  visibility?: number;
  conversion?: number;
  revenueCapture?: number;
  date?: string;
}

export interface ResolvedDisplayScores {
  scores: HealthScores;
  /** Headline Reputation Boost Score — always consistent with driver/outcome shown. */
  overall: number;
  /** Stored audit overall before live overlay (for delta hints). */
  auditOverall: number;
  /** Raw nightly overall when it differs from the blended headline. */
  nightlyOverall: number | null;
}

function resolveDriverOutcome(
  auditScores: HealthScores,
  live?: LiveScoreSlice | null
): { driverScore: number; outcomeIndex: number } {
  const driverScore =
    live?.driverScore ??
    live?.conversion ??
    auditScores.driverScore ??
    auditScores.conversion ??
    0;

  const outcomeIndex =
    live?.outcomeIndex ??
    (live?.visibility != null && live?.revenueCapture != null
      ? computeOutcomeIndex(live.visibility, live.revenueCapture)
      : undefined) ??
    auditScores.outcomeIndex ??
    computeOutcomeIndex(auditScores.visibility ?? 0, auditScores.revenueCapture ?? 0);

  return { driverScore, outcomeIndex };
}

/**
 * Resolve scores shown in the dashboard so headline overall always matches
 * profile strength and ranking outcome (70/30 blend).
 */
export function resolveDisplayScores(
  audit: FullAuditPayload,
  live?: LiveScoreSlice | null
): ResolvedDisplayScores | null {
  const auditScores = normalizeHealthScores(audit.strategy?.scores);
  if (!auditScores) return null;

  const { driverScore, outcomeIndex } = resolveDriverOutcome(auditScores, live);
  const overall = computeOverallFromDriverOutcome(driverScore, outcomeIndex);

  const nightlyOverall =
    live?.overall != null && live.overall !== overall ? live.overall : null;

  const scores: HealthScores = {
    ...auditScores,
    overall,
    driverScore,
    outcomeIndex,
    visibility: live?.visibility ?? auditScores.visibility,
    conversion: live?.conversion ?? auditScores.conversion,
    revenueCapture: live?.revenueCapture ?? auditScores.revenueCapture,
  };

  return {
    scores,
    overall,
    auditOverall: auditScores.overall,
    nightlyOverall,
  };
}
