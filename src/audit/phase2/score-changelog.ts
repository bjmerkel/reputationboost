import type { HealthScores, RankMovement, ScoreChangelogEntry, ScoreComponent } from "../types";
import type { ScoreDailySnapshot } from "../types/timeseries";
import { positionVisibilityScore } from "./scoring";

const COMPONENT_LABELS: Record<ScoreComponent, string> = {
  visibility: "Visibility",
  conversion: "Conversion",
  revenueCapture: "Revenue capture",
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

function keywordRankEntry(movement: RankMovement): ScoreChangelogEntry | null {
  const from = movement.fromPosition;
  const to = movement.toPosition;
  if (from === to) return null;

  const fromVis = from != null ? positionVisibilityScore(from) : 0;
  const toVis = to != null ? positionVisibilityScore(to) : 0;
  const delta = Math.round((toVis - fromVis) * 0.5);

  if (movement.improved) {
    const fromLabel = from == null ? "unranked" : `#${from}`;
    const toLabel = to == null ? "unranked" : `#${to}`;
    return {
      component: "visibility",
      delta: Math.max(1, delta),
      keyword: movement.keyword,
      label: `Entered stronger position on "${movement.keyword}" (${fromLabel} → ${toLabel})`,
    };
  }

  const fromLabel = from == null ? "unranked" : `#${from}`;
  const toLabel = to == null ? "unranked" : `#${to}`;
  return {
    component: "visibility",
    delta: Math.min(-1, delta),
    keyword: movement.keyword,
    label: `Dropped on "${movement.keyword}" (${fromLabel} → ${toLabel})`,
  };
}

export function buildScoreChangelogFromSnapshots(
  current: ScoreDailySnapshot,
  prior: ScoreDailySnapshot,
  rankMovements: RankMovement[] = []
): ScoreChangelogEntry[] {
  const entries: ScoreChangelogEntry[] = [];

  const overallDelta = current.overall - prior.overall;
  if (overallDelta !== 0) {
    entries.push({
      component: "overall",
      delta: overallDelta,
      label:
        overallDelta > 0
          ? `Listing strength up ${overallDelta} pts`
          : `Listing strength down ${Math.abs(overallDelta)} pts`,
    });
  }

  for (const component of ["visibility", "conversion", "revenueCapture"] as ScoreComponent[]) {
    const entry = componentDelta(current[component], prior[component], component);
    if (entry) entries.push(entry);
  }

  for (const movement of rankMovements) {
    const entry = keywordRankEntry(movement);
    if (entry) entries.push(entry);
  }

  return entries.slice(0, 8);
}

export function buildScoreChangelogFromHealthScores(
  current: HealthScores,
  prior: HealthScores,
  rankMovements: RankMovement[] = []
): ScoreChangelogEntry[] {
  return buildScoreChangelogFromSnapshots(
    {
      businessId: "",
      date: "",
      overall: current.overall,
      visibility: current.visibility,
      conversion: current.conversion,
      revenueCapture: current.revenueCapture,
      source: "audit",
    },
    {
      businessId: "",
      date: "",
      overall: prior.overall,
      visibility: prior.visibility,
      conversion: prior.conversion,
      revenueCapture: prior.revenueCapture,
      source: "audit",
    },
    rankMovements
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
