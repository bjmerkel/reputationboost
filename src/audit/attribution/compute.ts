import { pickPrimaryKeyword, resolveTargetKeywords } from "./keywords";
import { buildAttributionNarrative } from "./narrative";
import { estimateAttributionRevenue, formatCurrency } from "./roi";
import type { CompletedTaskRecord } from "@/audit/storage-attribution";
import {
  getRankSnapshotsInRange,
  sumPerformanceInRange,
  upsertActionAttribution,
} from "@/audit/storage-attribution";

const DEFAULT_WINDOW_DAYS = 14;

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
    formatDateYmd(addDays(end, -1))
  );
  return medianRank(snapshots.map((s) => s.rank));
}

export async function computeAttributionForTask(
  record: CompletedTaskRecord,
  windowDays = DEFAULT_WINDOW_DAYS
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
  const rankByKeyword = new Map<string, { before: number | null; after: number | null }>();
  let keywordsImproved = 0;

  for (const keyword of targetKeywords) {
    const before = await rankMedianInWindow(businessId, keyword, preStart, preEnd);
    const after = await rankMedianInWindow(businessId, keyword, postStart, effectivePostEnd);
    rankByKeyword.set(keyword, { before, after });

    if (before !== null && after !== null && after < before) {
      keywordsImproved += 1;
    } else if (before === null && after !== null && after <= 3) {
      keywordsImproved += 1;
    }
  }

  const primaryKeyword = pickPrimaryKeyword(targetKeywords, rankByKeyword);
  const primaryRanks = primaryKeyword ? rankByKeyword.get(primaryKeyword) : undefined;
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

  const callsDelta = postMetrics.calls - preMetrics.calls;
  const directionsDelta = postMetrics.direction_requests - preMetrics.direction_requests;
  const websiteClicksDelta = postMetrics.website_clicks - preMetrics.website_clicks;
  const impressionsDelta =
    postMetrics.impressions_maps +
    postMetrics.impressions_search -
    (preMetrics.impressions_maps + preMetrics.impressions_search);

  const preliminary = now < postEnd;

  const estimatedRevenue =
    avgCustomerValue && avgCustomerValue > 0
      ? estimateAttributionRevenue(
          { calls: callsDelta, directions: directionsDelta, websiteClicks: websiteClicksDelta },
          avgCustomerValue
        )
      : null;

  let narrative = buildAttributionNarrative({
    taskType: task.type,
    title: task.title,
    publishedAt: task.completedAt,
    primaryKeyword,
    rankBefore,
    rankAfter,
    callsDelta,
    directionsDelta,
    websiteClicksDelta,
    preliminary,
  });

  if (estimatedRevenue && estimatedRevenue > 0) {
    narrative += ` → ~${formatCurrency(estimatedRevenue, avgCustomerValueCurrency)} estimated`;
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
    rankBefore,
    rankAfter,
    rankDelta,
    keywordsImproved,
    callsDelta,
    directionsDelta,
    websiteClicksDelta,
    impressionsDelta,
    estimatedRevenue,
    narrative,
  });
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

  try {
    await computeAttributionForTask(context);
  } catch (error) {
    console.warn(
      `[attribution] post-completion compute failed for ${taskId}:`,
      error instanceof Error ? error.message : error
    );
  }
}
