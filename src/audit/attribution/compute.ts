import { pickPrimaryKeyword, resolveTargetKeywords } from "./keywords";
import { buildAttributionNarrative } from "./narrative";
import { estimateAttributionRevenue, formatCurrency } from "./roi";
import { taskCanAffectLocalRank } from "@/audit/market/gbp-change-detector";
import { enqueueEventRankPulse } from "@/audit/market/refresh-queue";
import type { CompletedTaskRecord } from "@/audit/storage-attribution";
import { computeGridDiff } from "@/audit/geo/grid-diff";
import { refreshGridAfterTaskIfNeeded } from "@/audit/geo/grid-refresh";
import {
  gridCoverageNearDateAdmin,
  loadGridForDateAdmin,
} from "@/audit/storage-grid-snapshots";
import {
  enrichTaskWithProjectionSnapshot,
  resolveProjectionsFromTask,
  snapshotTaskProjections,
} from "./projection-snapshot";
import {
  computeObservedDriverImpact,
  computeObservedOutcomeImpact,
} from "@/audit/phase2/projection-accuracy";
import type { KeywordRankSnapshot } from "@/audit/types";
import {
  buildKeywordFromRadiusMedians,
  medianRanksByRadius,
  serviceAreaImproved,
  weakestRadiusImproved,
} from "@/audit/phase2/service-area-attribution";
import { loadAuditByIdForBusiness } from "@/audit/storage-supabase";
import { radiusWeightsForAudit, RADIUS_PROFILE_WEIGHTS } from "@/audit/phase2/radius-profiles";
import { keywordServiceAreaVisibilityScore } from "@/audit/phase2/scoring";
import { loadGlobalScoreCalibrationAdmin, refreshGlobalScoreCalibration } from "@/audit/storage-calibration-global";
import { MARKET_REFRESH_FLAGS } from "@/lib/feature-flags";
import {
  getRankSnapshotsInRange,
  listActionAttributionsForBusinessAdmin,
  listCompletedTasksForBusiness,
  sumPerformanceInRange,
  upsertActionAttribution,
} from "@/audit/storage-attribution";
import { listScoreDailyForBusinessAdmin } from "@/audit/storage-score-daily";
import {
  applyAttributionCredit,
  countOverlappingPostWindows,
  formatAttributionCreditNote,
} from "./credit-sharing";
import { buildAttributionCalibration } from "@/audit/phase2/attribution-calibration";
import { resolveAttributionWindowDays } from "./window";

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function medianRank(ranks: Array<number | null>): number | null {
  const valid = ranks.filter((r): r is number => r !== null).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? Math.round((valid[mid - 1] + valid[mid]) / 2)
    : valid[mid];
}

async function rankMedianInWindow(
  businessId: string,
  keyword: string,
  start: Date,
  end: Date
): Promise<number | null> {
  const snapshots = await getRankSnapshotsInRange(
    businessId,
    keyword,
    formatDateYmd(start),
    formatDateYmd(addDays(end, -1)),
    { multiRadius: false }
  );
  return medianRank(snapshots.map((s) => s.rank));
}

async function keywordSnapshotAtWindowEnd(
  businessId: string,
  keyword: string,
  start: Date,
  end: Date,
  template?: KeywordRankSnapshot
): Promise<KeywordRankSnapshot | null> {
  const snapshots = await getRankSnapshotsInRange(
    businessId,
    keyword,
    formatDateYmd(start),
    formatDateYmd(addDays(end, -1)),
    { multiRadius: true }
  );
  if (snapshots.length === 0) return null;

  const medians = medianRanksByRadius(
    snapshots.map((s) => ({ distanceMiles: s.distanceMiles, rank: s.rank }))
  );
  if ([...medians.values()].every((r) => r == null)) return null;

  return buildKeywordFromRadiusMedians(keyword, medians, template);
}

export async function computeAttributionForTask(
  record: CompletedTaskRecord,
  windowDays = resolveAttributionWindowDays(record.task.type)
): Promise<void> {
  const { task, businessId, keywords, avgCustomerValue, avgCustomerValueCurrency } = record;
  if (!task.completedAt || task.status !== "completed") return;

  const publishedAt = new Date(task.completedAt);
  const preStart = addDays(publishedAt, -windowDays);
  const preEnd = publishedAt;
  const postStart = publishedAt;
  const postEnd = addDays(publishedAt, windowDays);
  const now = new Date();
  const effectivePostEnd = now < postEnd ? now : postEnd;

  const targetKeywords = resolveTargetKeywords(task, keywords);
  const audit = await loadAuditByIdForBusiness(businessId, task.auditId);
  const weights = audit ? radiusWeightsForAudit(audit) : RADIUS_PROFILE_WEIGHTS.neighborhood;
  const templateByKeyword = new Map(
    (audit?.rankings.keywords ?? []).map((kw) => [kw.keyword.toLowerCase(), kw])
  );

  const rankByKeyword = new Map<string, { before: number | null; after: number | null }>();
  const visibilityByKeyword = new Map<
    string,
    { before: number; after: number; widerRadiusImproved: number | null }
  >();
  let keywordsImproved = 0;

  for (const keyword of targetKeywords) {
    const template = templateByKeyword.get(keyword.toLowerCase());
    const beforeRank = await rankMedianInWindow(businessId, keyword, preStart, preEnd);
    const afterRank = await rankMedianInWindow(businessId, keyword, postStart, effectivePostEnd);
    rankByKeyword.set(keyword, { before: beforeRank, after: afterRank });

    const beforeKw = await keywordSnapshotAtWindowEnd(
      businessId,
      keyword,
      preStart,
      preEnd,
      template
    );
    const afterKw = await keywordSnapshotAtWindowEnd(
      businessId,
      keyword,
      postStart,
      effectivePostEnd,
      template
    );

    if (beforeKw && afterKw) {
      const visBefore = keywordServiceAreaVisibilityScore(beforeKw, weights);
      const visAfter = keywordServiceAreaVisibilityScore(afterKw, weights);
      visibilityByKeyword.set(keyword, {
        before: visBefore,
        after: visAfter,
        widerRadiusImproved: weakestRadiusImproved(beforeKw, afterKw),
      });

      if (serviceAreaImproved(beforeKw, afterKw, weights)) {
        keywordsImproved += 1;
      }
    } else if (
      beforeRank !== null &&
      afterRank !== null &&
      afterRank < beforeRank
    ) {
      keywordsImproved += 1;
    } else if (beforeRank === null && afterRank !== null && afterRank <= 3) {
      keywordsImproved += 1;
    }
  }

  const primaryKeyword = pickPrimaryKeyword(targetKeywords, rankByKeyword);
  const primaryRanks = primaryKeyword ? rankByKeyword.get(primaryKeyword) : undefined;
  const primaryVisibility = primaryKeyword
    ? visibilityByKeyword.get(primaryKeyword)
    : undefined;
  const rankBefore = primaryRanks?.before ?? null;
  const rankAfter = primaryRanks?.after ?? null;
  const rankDelta =
    rankBefore !== null && rankAfter !== null ? rankAfter - rankBefore : null;

  const preMetrics = await sumPerformanceInRange(
    businessId,
    formatDateYmd(preStart),
    formatDateYmd(addDays(preEnd, -1))
  );
  const postMetrics = await sumPerformanceInRange(
    businessId,
    formatDateYmd(postStart),
    formatDateYmd(addDays(effectivePostEnd, -1))
  );
  const priorBaselineStart = addDays(publishedAt, -windowDays * 2);
  const priorBaselineEnd = addDays(publishedAt, -windowDays);
  const priorBaseline = await sumPerformanceInRange(
    businessId,
    formatDateYmd(priorBaselineStart),
    formatDateYmd(addDays(priorBaselineEnd, -1))
  );

  const peerTasks = await listCompletedTasksForBusiness(businessId, windowDays * 4);
  const overlapCount = countOverlappingPostWindows(
    publishedAt,
    windowDays,
    peerTasks
      .filter((record) => record.task.completedAt)
      .map((record) => ({
        taskId: record.task.id,
        publishedAt: record.task.completedAt!,
      })),
    task.id
  );

  const canAffectRank = taskCanAffectLocalRank(task.type);
  const credit = applyAttributionCredit({
    pre: preMetrics,
    post: postMetrics,
    priorBaseline,
    rank: {
      rankBefore,
      rankAfter,
      rankDelta,
      keywordsImproved,
    },
    overlapCount,
    canAffectRank,
  });

  const callsDelta = credit.engagement.calls;
  const directionsDelta = credit.engagement.directions;
  const websiteClicksDelta = credit.engagement.websiteClicks;
  const impressionsDelta = credit.engagement.impressions;
  const creditedRankBefore = credit.rank.rankBefore;
  const creditedRankAfter = credit.rank.rankAfter;
  const creditedRankDelta = credit.rank.rankDelta;
  const creditedKeywordsImproved = credit.rank.keywordsImproved;

  const preliminary = now < postEnd;

  let gridCoverageBefore: number | null = null;
  let gridCoverageAfter: number | null = null;
  let cellsImproved: number | null = null;

  if (primaryKeyword) {
    const publishedDate = formatDateYmd(publishedAt);
    const postDate = formatDateYmd(effectivePostEnd);
    const beforeSnap = await gridCoverageNearDateAdmin(
      businessId,
      primaryKeyword,
      publishedDate,
      "before"
    );
    const afterSnap = await gridCoverageNearDateAdmin(
      businessId,
      primaryKeyword,
      postDate,
      "after"
    );

    if (beforeSnap) gridCoverageBefore = beforeSnap.coveragePercent;
    if (afterSnap) gridCoverageAfter = afterSnap.coveragePercent;

    if (beforeSnap && afterSnap) {
      const [beforeGrid, afterGrid] = await Promise.all([
        loadGridForDateAdmin(businessId, primaryKeyword, beforeSnap.date),
        loadGridForDateAdmin(businessId, primaryKeyword, afterSnap.date),
      ]);
      if (beforeGrid.length > 0 && afterGrid.length > 0) {
        const diff = computeGridDiff(
          beforeGrid,
          afterGrid,
          primaryKeyword,
          beforeSnap.date,
          afterSnap.date
        );
        cellsImproved = diff.cellsImproved;
      }
    }
  }

  const estimatedRevenue =
    avgCustomerValue && avgCustomerValue > 0
      ? estimateAttributionRevenue(
          { calls: callsDelta, directions: directionsDelta, websiteClicks: websiteClicksDelta },
          avgCustomerValue
        )
      : null;

  const keywordsMentioned = Array.isArray(task.payload.keywordsHit)
    ? task.payload.keywordsHit.filter((value): value is string => typeof value === "string")
    : [];

  let narrative = buildAttributionNarrative({
    taskType: task.type,
    title: task.title,
    publishedAt: task.completedAt,
    primaryKeyword,
    keywordsMentioned: task.type === "review_response" ? keywordsMentioned : undefined,
    rankBefore: creditedRankBefore,
    rankAfter: creditedRankAfter,
    serviceAreaVisibilityBefore: primaryVisibility?.before ?? null,
    serviceAreaVisibilityAfter: primaryVisibility?.after ?? null,
    widerRadiusImproved: primaryVisibility?.widerRadiusImproved ?? null,
    callsDelta,
    directionsDelta,
    websiteClicksDelta,
    preliminary,
    gridCoverageBefore,
    gridCoverageAfter,
    cellsImproved,
  });

  const creditNote = formatAttributionCreditNote(overlapCount, canAffectRank);
  if (creditNote) {
    narrative += creditNote;
  }

  if (estimatedRevenue && estimatedRevenue > 0) {
    narrative += ` → ~${formatCurrency(estimatedRevenue, avgCustomerValueCurrency)} estimated`;
  }

  const projections = resolveProjectionsFromTask(task);
  const projectedDriverImpact = projections.projectedDriverImpact;
  const projectedOutcomeImpact = projections.projectedOutcomeImpact;
  const projectedRevenueGain = projections.projectedRevenueGain;
  const scoreSnapshots = await listScoreDailyForBusinessAdmin(businessId, windowDays * 3);
  const observed = computeObservedDriverImpact(
    scoreSnapshots,
    task.completedAt!,
    windowDays
  );
  const observedOutcome = computeObservedOutcomeImpact(
    scoreSnapshots,
    task.completedAt!,
    windowDays
  );

  if (
    observed.observedDriverImpact != null &&
    projectedDriverImpact != null &&
    !preliminary
  ) {
    const error = observed.observedDriverImpact - projectedDriverImpact;
    if (Math.abs(error) >= 3) {
      narrative += ` · Driver score moved ${observed.observedDriverImpact >= 0 ? "+" : ""}${observed.observedDriverImpact} pts (projected ${projectedDriverImpact >= 0 ? "+" : ""}${projectedDriverImpact})`;
    } else if (observed.observedDriverImpact > 0) {
      narrative += ` · Driver score +${observed.observedDriverImpact} pts`;
    }
  }

  if (
    observedOutcome.observedOutcomeImpact != null &&
    projectedOutcomeImpact != null &&
    !preliminary
  ) {
    const outcomeError = observedOutcome.observedOutcomeImpact - projectedOutcomeImpact;
    if (Math.abs(outcomeError) >= 3) {
      narrative += ` · Outcome index ${observedOutcome.observedOutcomeImpact >= 0 ? "+" : ""}${observedOutcome.observedOutcomeImpact} (projected ${projectedOutcomeImpact >= 0 ? "+" : ""}${projectedOutcomeImpact})`;
    } else if (observedOutcome.observedOutcomeImpact > 0) {
      narrative += ` · Outcome index +${observedOutcome.observedOutcomeImpact}`;
    }
  }

  if (
    estimatedRevenue != null &&
    estimatedRevenue > 0 &&
    projectedRevenueGain != null &&
    projectedRevenueGain > 0 &&
    !preliminary
  ) {
    const revenueError = estimatedRevenue - projectedRevenueGain;
    if (Math.abs(revenueError) >= Math.max(100, projectedRevenueGain * 0.5)) {
      narrative += ` · Revenue ~${formatCurrency(estimatedRevenue, avgCustomerValueCurrency)} (projected ${formatCurrency(projectedRevenueGain, avgCustomerValueCurrency)})`;
    }
  }

  await upsertActionAttribution({
    executionTaskId: task.id,
    businessId,
    taskType: task.type,
    actionItemId: task.actionItemId,
    title: task.title,
    publishedAt: task.completedAt,
    windowDays,
    primaryKeyword,
    rankBefore: creditedRankBefore,
    rankAfter: creditedRankAfter,
    rankDelta: creditedRankDelta,
    keywordsImproved: creditedKeywordsImproved,
    callsDelta,
    directionsDelta,
    websiteClicksDelta,
    impressionsDelta,
    estimatedRevenue,
    narrative,
    projectedDriverImpact,
    projectedOutcomeImpact,
    projectedRevenueGain,
    observedDriverImpact: observed.observedDriverImpact,
    driverScoreBefore: observed.driverScoreBefore,
    driverScoreAfter: observed.driverScoreAfter,
    observedOutcomeImpact: observedOutcome.observedOutcomeImpact,
    outcomeIndexBefore: observedOutcome.outcomeIndexBefore,
    outcomeIndexAfter: observedOutcome.outcomeIndexAfter,
    gridCoverageBefore,
    gridCoverageAfter,
    cellsImproved,
  });

  const rankImproved =
    creditedRankBefore !== null &&
    creditedRankAfter !== null
      ? creditedRankAfter < creditedRankBefore
      : rankBefore === null && rankAfter !== null && rankAfter <= 3;

  const serviceAreaImprovedFlag =
    primaryVisibility != null && primaryVisibility.after > primaryVisibility.before;

  void refreshGridAfterTaskIfNeeded(record, {
    primaryKeyword,
    rankImproved: rankImproved || serviceAreaImprovedFlag,
    taskId: task.id,
  }).catch((error) => {
    console.warn(
      `[attribution] grid refresh failed for ${task.id}:`,
      error instanceof Error ? error.message : error
    );
  });
}

async function prepareRecordWithProjectionSnapshot(
  record: CompletedTaskRecord
): Promise<CompletedTaskRecord> {
  const audit = await loadAuditByIdForBusiness(record.businessId, record.task.auditId);
  if (!audit) return record;

  const globalCalibration = await loadGlobalScoreCalibrationAdmin().catch(() => ({}));
  const businessAttributions = await listActionAttributionsForBusinessAdmin(
    record.businessId,
    50
  ).catch(() => []);
  const businessCalibration = buildAttributionCalibration(
    businessAttributions.filter((row) => !row.preliminary)
  );

  const snapshot = snapshotTaskProjections(audit, record.task, {
    avgCustomerValue: record.avgCustomerValue,
    calibration: businessCalibration,
    globalCalibration,
  });

  return {
    ...record,
    task: enrichTaskWithProjectionSnapshot(record.task, snapshot),
  };
}

export async function recomputeAttributionsForBusiness(
  businessId: string,
  lookbackDays = 60
): Promise<number> {
  const { listCompletedTasksForBusiness } = await import("@/audit/storage-attribution");
  const tasks = await listCompletedTasksForBusiness(businessId, lookbackDays);

  for (const record of tasks) {
    try {
      await computeAttributionForTask(record);
    } catch (error) {
      console.warn(
        `[attribution] failed for task ${record.task.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return tasks.length;
}

export async function computeAttributionAfterTaskCompletion(
  userId: string,
  taskId: string
): Promise<void> {
  const { getCompletedTaskContext } = await import("@/audit/storage-attribution");
  const context = await getCompletedTaskContext(userId, taskId);
  if (!context || context.task.status !== "completed") return;

  if (taskCanAffectLocalRank(context.task.type)) {
    const completedAt = new Date(context.task.completedAt ?? Date.now());
    completedAt.setUTCDate(
      completedAt.getUTCDate() + MARKET_REFRESH_FLAGS.eventDelayDays
    );
    await enqueueEventRankPulse({
      businessId: context.businessId,
      triggerSource: "task_completion",
      triggerRef: taskId,
      runAfter: completedAt.toISOString(),
      callsEstimated: context.keywords.length,
    }).catch((error) => {
      console.warn(
        `[attribution] delayed rank pulse scheduling failed for ${taskId}:`,
        error instanceof Error ? error.message : error
      );
    });
  }

  try {
    const enriched = await prepareRecordWithProjectionSnapshot(context);
    await computeAttributionForTask(enriched);
    void refreshGlobalScoreCalibration().catch((error) => {
      console.warn(
        `[attribution] calibration refresh failed after ${taskId}:`,
        error instanceof Error ? error.message : error
      );
    });
  } catch (error) {
    console.warn(
      `[attribution] post-completion compute failed for ${taskId}:`,
      error instanceof Error ? error.message : error
    );
  }
}
