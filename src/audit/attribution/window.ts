import type { ExecutionType } from "@/audit/types";
import { taskCanAffectLocalRank } from "@/audit/market/gbp-change-detector";

export const RANK_ATTRIBUTION_WINDOW_DAYS = 14;
export const ENGAGEMENT_ATTRIBUTION_WINDOW_DAYS = 7;

/** Rank-affecting GBP work needs a longer pre/post window; engagement-only tasks can use 7 days. */
export function resolveAttributionWindowDays(taskType: ExecutionType): number {
  return taskCanAffectLocalRank(taskType)
    ? RANK_ATTRIBUTION_WINDOW_DAYS
    : ENGAGEMENT_ATTRIBUTION_WINDOW_DAYS;
}
