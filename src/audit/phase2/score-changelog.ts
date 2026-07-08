import type {
  HealthScores,
  KeywordRankSnapshot,
  RankMovement,
  ScoreChangelogEntry,
  ScoreComponent,
} from "../types";
import type { ScoreDailySnapshot } from "../types/timeseries";
import { detectPackFragility, positionVisibilityScore } from "./scoring";
import { computeOutcomeIndex } from "./score-driver-outcome";

const COMPONENT_LABELS: Record<ScoreComponent, string> = {
  visibility: "Visibility",
  conversion: "Conversion",
  revenueCapture: "Revenue capture",
  driver: "Profile strength",
  outcome: "Ranking outcome",
};

function componentDelta(
  current: number,
  prior: number,
  component: ScoreComponent
): ScoreChangelogEntry | null {
  const delta = current - prior;
  if (delta === 0) return null;
  return {
    component,
    delta,
    label:
      delta > 0
        ? `${COMPONENT_LABELS[component]} up ${delta} pts`
        : `${COMPONENT_LABELS[component]} down ${Math.abs(delta)} pts`,
  };
}

function packFragilityHint(
  keyword: string,
  keywordRanks?: Map<string, KeywordRankSnapshot>
): string {
  const snapshot = keywordRanks?.get(keyword);
  if (!snapshot) return "";
  const fragility = detectPackFragility(snapshot);
  if (!fragility.fragile) return "";
  return fragility.weakestRadiusMiles
    ? ` — pack fragile beyond ${fragility.weakestRadiusMiles} mi`
    : " — pack fragile beyond 1 mi";
}

function keywordRankEntry(
  movement: RankMovement,
  keywordRanks?: Map<string, KeywordRankSnapshot>
): ScoreChangelogEntry | null {
  const from = movement.fromPosition;
  const to = movement.toPosition;
  if (from === to) return null;

  const fromVis = from != null ? positionVisibilityScore(from) : 0;
  const toVis = to != null ? positionVisibilityScore(to) : 0;
  const delta = Math.round((toVis - fromVis) * 0.3);
  const fragilityHint = packFragilityHint(movement.keyword, keywordRanks);

  if (movement.improved) {
    const fromLabel = from == null ? "unranked" : `#${from}`;
    const toLabel = to == null ? "unranked" : `#${to}`;
    return {
      component: "outcome",
      delta: Math.max(1, delta),
      keyword: movement.keyword,
      label: `Ranking improved at 1 mi on "${movement.keyword}" (${fromLabel} → ${toLabel})${fragilityHint}`,
    };
  }

  const fromLabel = from == null ? "unranked" : `#${from}`;
  const toLabel = to == null ? "unranked" : `#${to}`;
  return {
    component: "outcome",
    delta: Math.min(-1, delta),
    keyword: movement.keyword,
    label: `Ranking dropped at 1 mi on "${movement.keyword}" (${fromLabel} → ${toLabel})${fragilityHint}`,
  };
}

function driverOutcomeDeltas(
  current: ScoreDailySnapshot,
  prior: ScoreDailySnapshot
): ScoreChangelogEntry[] {
  const entries: ScoreChangelogEntry[] = [];
  const curDriver = current.driverScore ?? current.conversion;
  const prevDriver = prior.driverScore ?? prior.conversion;
  const driverDelta = curDriver - prevDriver;
  if (driverDelta !== 0) {
    entries.push({
      component: "driver",
      delta: driverDelta,
      label:
        driverDelta > 0
          ? `Profile strength up ${driverDelta} pts`
          : `Profile strength down ${Math.abs(driverDelta)} pts`,
    });
  }

  const curOutcome =
    current.outcomeIndex ??
    computeOutcomeIndex(current.visibility, current.revenueCapture);
  const prevOutcome =
    prior.outcomeIndex ??
    computeOutcomeIndex(prior.visibility, prior.revenueCapture);
  const outcomeDelta = curOutcome - prevOutcome;
  if (outcomeDelta !== 0) {
    entries.push({
      component: "outcome",
      delta: outcomeDelta,
      label:
        outcomeDelta > 0
          ? `Ranking outcome up ${outcomeDelta} pts`
          : `Ranking outcome down ${Math.abs(outcomeDelta)} pts`,
    });
  }

  return entries;
}

export function buildScoreChangelogFromSnapshots(
  current: ScoreDailySnapshot,
  prior: ScoreDailySnapshot,
  rankMovements: RankMovement[] = [],
  keywordRanks?: Map<string, KeywordRankSnapshot>
): ScoreChangelogEntry[] {
  const entries: ScoreChangelogEntry[] = [];

  const overallDelta = current.overall - prior.overall;
  if (overallDelta !== 0) {
    entries.push({
      component: "overall",
      delta: overallDelta,
      label:
        overallDelta > 0
          ? `Reputation Boost Score up ${overallDelta} pts`
          : `Reputation Boost Score down ${Math.abs(overallDelta)} pts`,
    });
  }

  for (const component of ["visibility", "conversion", "revenueCapture"] as const) {
    const entry = componentDelta(current[component], prior[component], component);
    if (entry) entries.push(entry);
  }

  entries.push(...driverOutcomeDeltas(current, prior));

  for (const movement of rankMovements) {
    const entry = keywordRankEntry(movement, keywordRanks);
    if (entry) entries.push(entry);
  }

  return entries.slice(0, 8);
}

export function buildScoreChangelogFromHealthScores(
  current: HealthScores,
  prior: HealthScores,
  rankMovements: RankMovement[] = [],
  keywordRanks?: Map<string, KeywordRankSnapshot>
): ScoreChangelogEntry[] {
  return buildScoreChangelogFromSnapshots(
    {
      businessId: "",
      date: "",
      overall: current.overall,
      driverScore: current.driverScore,
      outcomeIndex: current.outcomeIndex,
      visibility: current.visibility,
      conversion: current.conversion,
      revenueCapture: current.revenueCapture,
      source: "audit",
    },
    {
      businessId: "",
      date: "",
      overall: prior.overall,
      driverScore: prior.driverScore,
      outcomeIndex: prior.outcomeIndex,
      visibility: prior.visibility,
      conversion: prior.conversion,
      revenueCapture: prior.revenueCapture,
      source: "audit",
    },
    rankMovements,
    keywordRanks
  );
}

export function buildRankMovementsFromSnapshots(
  keywords: string[],
  currentRanks: Map<string, number | null>,
  priorRanks: Map<string, number | null>
): RankMovement[] {
  const movements: RankMovement[] = [];

  for (const keyword of keywords) {
    const fromPosition = priorRanks.get(keyword) ?? null;
    const toPosition = currentRanks.get(keyword) ?? null;
    if (fromPosition === toPosition) continue;

    const curRank = toPosition ?? 99;
    const prevRank = fromPosition ?? 99;

    movements.push({
      keyword,
      fromPosition,
      toPosition,
      improved: curRank < prevRank,
    });
  }

  return movements.sort((a, b) => {
    const aDelta = (a.fromPosition ?? 99) - (a.toPosition ?? 99);
    const bDelta = (b.fromPosition ?? 99) - (b.toPosition ?? 99);
    return bDelta - aDelta;
  });
}
