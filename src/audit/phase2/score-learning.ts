import type { PerformanceDailyRow, RankSnapshotRow } from "../types/timeseries";
import {
  buildBacktestSamples,
  type BacktestSample,
} from "./score-backtest";

export interface ClickShareCurve {
  pack1: number;
  pack2: number;
  pack3: number;
  outsidePack: number;
  deepOutside: number;
}

export const DEFAULT_CLICK_SHARE_CURVE: ClickShareCurve = {
  pack1: 45,
  pack2: 25,
  pack3: 15,
  outsidePack: 3,
  deepOutside: 3,
};

export interface ScoreBlendWeights {
  visibility: number;
  conversion: number;
  revenueCapture: number;
}

export const DEFAULT_BLEND_WEIGHTS: ScoreBlendWeights = {
  visibility: 0.5,
  conversion: 0.3,
  revenueCapture: 0.2,
};

export interface LearnedScoreModel {
  clickShare: ClickShareCurve;
  clickShareSamples: number;
  blendWeights: ScoreBlendWeights;
  blendSamples: number;
  source: "learned" | "default" | "blended";
  updatedAt: string;
}

export const DEFAULT_LEARNED_SCORE_MODEL: LearnedScoreModel = {
  clickShare: DEFAULT_CLICK_SHARE_CURVE,
  clickShareSamples: 0,
  blendWeights: DEFAULT_BLEND_WEIGHTS,
  blendSamples: 0,
  source: "default",
  updatedAt: new Date(0).toISOString(),
};

const MIN_CLICK_SHARE_SAMPLES = 40;
const MIN_BLEND_SAMPLES = 30;

function isCenterSnapshot(row: RankSnapshotRow): boolean {
  return row.distanceMiles === 1 && row.gridNorth === 0 && row.gridEast === 0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;

  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

function blendRatio(sampleSize: number, minSamples: number, maxWeight = 0.75): number {
  if (sampleSize < minSamples) return 0;
  const t = Math.min(1, (sampleSize - minSamples) / minSamples);
  return t * maxWeight;
}

export function blendClickShareCurve(
  learned: ClickShareCurve,
  defaults: ClickShareCurve,
  sampleSize: number
): ClickShareCurve {
  const w = blendRatio(sampleSize, MIN_CLICK_SHARE_SAMPLES);
  if (w === 0) return defaults;

  return {
    pack1: learned.pack1 * w + defaults.pack1 * (1 - w),
    pack2: learned.pack2 * w + defaults.pack2 * (1 - w),
    pack3: learned.pack3 * w + defaults.pack3 * (1 - w),
    outsidePack: learned.outsidePack * w + defaults.outsidePack * (1 - w),
    deepOutside: learned.deepOutside * w + defaults.deepOutside * (1 - w),
  };
}

export function blendScoreWeights(
  learned: ScoreBlendWeights,
  defaults: ScoreBlendWeights,
  sampleSize: number
): ScoreBlendWeights {
  const w = blendRatio(sampleSize, MIN_BLEND_SAMPLES);
  if (w === 0) return defaults;

  const visibility = learned.visibility * w + defaults.visibility * (1 - w);
  const conversion = learned.conversion * w + defaults.conversion * (1 - w);
  const revenueCapture =
    learned.revenueCapture * w + defaults.revenueCapture * (1 - w);
  const sum = visibility + conversion + revenueCapture;

  return {
    visibility: visibility / sum,
    conversion: conversion / sum,
    revenueCapture: revenueCapture / sum,
  };
}

interface DailyEngagement {
  impressionsMaps: number;
  actions: number;
}

function buildDailyEngagementIndex(
  performance: PerformanceDailyRow[]
): Map<string, DailyEngagement> {
  const index = new Map<string, DailyEngagement>();

  for (const row of performance) {
    const key = `${row.businessId}|${row.date}`;
    const current = index.get(key) ?? { impressionsMaps: 0, actions: 0 };

    if (row.metric === "impressions_maps") {
      current.impressionsMaps += row.value;
    } else if (
      row.metric === "calls" ||
      row.metric === "direction_requests" ||
      row.metric === "website_clicks"
    ) {
      current.actions += row.value;
    }

    index.set(key, current);
  }

  return index;
}

function positionBucket(rank: number): keyof ClickShareCurve | null {
  if (rank === 1) return "pack1";
  if (rank === 2) return "pack2";
  if (rank === 3) return "pack3";
  if (rank <= 10) return "outsidePack";
  if (rank > 10) return "deepOutside";
  return null;
}

/**
 * Fit click-share curve from rank snapshots paired with daily map engagement.
 * Uses median action rate (calls+directions+clicks / impressions_maps) per rank bucket.
 */
export function learnClickShareCurve(
  ranks: RankSnapshotRow[],
  performance: PerformanceDailyRow[]
): { curve: ClickShareCurve; sampleCount: number } {
  const engagement = buildDailyEngagementIndex(performance);
  const ratesByBucket = new Map<keyof ClickShareCurve, number[]>();

  for (const row of ranks) {
    if (!isCenterSnapshot(row) || row.rank == null) continue;

    const bucket = positionBucket(row.rank);
    if (!bucket) continue;

    const daily = engagement.get(`${row.businessId}|${row.date}`);
    if (!daily || daily.impressionsMaps < 20) continue;

    const rate = daily.actions / daily.impressionsMaps;
    const list = ratesByBucket.get(bucket) ?? [];
    list.push(rate);
    ratesByBucket.set(bucket, list);
  }

  const medians: Partial<Record<keyof ClickShareCurve, number>> = {};
  let sampleCount = 0;

  for (const [bucket, rates] of ratesByBucket) {
    const med = median(rates);
    if (med != null) {
      medians[bucket] = med;
      sampleCount += rates.length;
    }
  }

  if (!medians.pack1 || sampleCount < MIN_CLICK_SHARE_SAMPLES) {
    return { curve: DEFAULT_CLICK_SHARE_CURVE, sampleCount };
  }

  const pack1Rate = medians.pack1;
  const toShare = (rate: number | undefined, fallback: number) => {
    if (rate == null || pack1Rate <= 0) return fallback;
    return Math.max(1, Math.round((rate / pack1Rate) * DEFAULT_CLICK_SHARE_CURVE.pack1));
  };

  const curve: ClickShareCurve = {
    pack1: DEFAULT_CLICK_SHARE_CURVE.pack1,
    pack2: toShare(medians.pack2, DEFAULT_CLICK_SHARE_CURVE.pack2),
    pack3: toShare(medians.pack3, DEFAULT_CLICK_SHARE_CURVE.pack3),
    outsidePack: toShare(medians.outsidePack, DEFAULT_CLICK_SHARE_CURVE.outsidePack),
    deepOutside: toShare(medians.deepOutside, DEFAULT_CLICK_SHARE_CURVE.deepOutside),
  };

  // Keep in-pack shares monotonic (#1 >= #2 >= #3)
  curve.pack2 = Math.min(curve.pack2, curve.pack1);
  curve.pack3 = Math.min(curve.pack3, curve.pack2);

  return { curve, sampleCount };
}

/**
 * Learn overall score blend weights by grid search for best rank-movement prediction.
 * Higher conversion weight is favored when it negatively correlates with forward rank delta.
 */
export function learnBlendWeights(samples: BacktestSample[]): {
  weights: ScoreBlendWeights;
  sampleCount: number;
} {
  const withDelta = samples.filter((s) => s.rankDelta != null);
  if (withDelta.length < MIN_BLEND_SAMPLES) {
    return { weights: DEFAULT_BLEND_WEIGHTS, sampleCount: withDelta.length };
  }

  const rankDeltas = withDelta.map((s) => s.rankDelta!);
  let bestWeights = DEFAULT_BLEND_WEIGHTS;
  let bestScore = Infinity;

  for (let visibility = 0.2; visibility <= 0.55; visibility += 0.05) {
    for (let conversion = 0.2; conversion <= 0.55; conversion += 0.05) {
      const revenueCapture = 1 - visibility - conversion;
      if (revenueCapture < 0.1 || revenueCapture > 0.35) continue;

      const blended = withDelta.map(
        (s) =>
          s.visibility * visibility +
          s.conversion * conversion +
          s.revenueCapture * revenueCapture
      );
      const corr = pearsonCorrelation(blended, rankDeltas);
      if (corr == null) continue;

      // Lower rank delta is better; want negative correlation (higher score → improvement)
      const score = corr;
      if (score < bestScore) {
        bestScore = score;
        bestWeights = { visibility, conversion, revenueCapture };
      }
    }
  }

  return { weights: bestWeights, sampleCount: withDelta.length };
}

export function buildLearnedScoreModel(input: {
  ranks: RankSnapshotRow[];
  performance: PerformanceDailyRow[];
  scores: import("../types/timeseries").ScoreDailySnapshot[];
  horizonDays?: number;
}): LearnedScoreModel {
  const clickShareResult = learnClickShareCurve(input.ranks, input.performance);
  const backtestSamples = buildBacktestSamples(
    input.scores,
    input.ranks,
    input.horizonDays
  );
  const blendResult = learnBlendWeights(backtestSamples);

  const clickShare = blendClickShareCurve(
    clickShareResult.curve,
    DEFAULT_CLICK_SHARE_CURVE,
    clickShareResult.sampleCount
  );
  const blendWeights = blendScoreWeights(
    blendResult.weights,
    DEFAULT_BLEND_WEIGHTS,
    blendResult.sampleCount
  );

  const hasLearnedClickShare = clickShareResult.sampleCount >= MIN_CLICK_SHARE_SAMPLES;
  const hasLearnedBlend = blendResult.sampleCount >= MIN_BLEND_SAMPLES;

  return {
    clickShare,
    clickShareSamples: clickShareResult.sampleCount,
    blendWeights,
    blendSamples: blendResult.sampleCount,
    source:
      hasLearnedClickShare && hasLearnedBlend
        ? "blended"
        : hasLearnedClickShare || hasLearnedBlend
          ? "learned"
          : "default",
    updatedAt: new Date().toISOString(),
  };
}

export function effectiveScoreModel(model?: LearnedScoreModel | null): LearnedScoreModel {
  if (!model) return DEFAULT_LEARNED_SCORE_MODEL;
  return model;
}

export function topClickSharePercent(model?: LearnedScoreModel | null): number {
  return effectiveScoreModel(model).clickShare.pack1;
}
