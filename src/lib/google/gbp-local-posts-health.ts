import type { GbpLocalPostCoverage } from "@/audit/types";
import { localPostTopicLabel } from "./gbp-local-posts";

export interface LocalPostsHealthReport {
  overallScore: number;
  apiAvailable: boolean;
  partialApi: boolean;
  postCount: number;
  livePostCount: number;
  postsLast30Days: number;
  daysSinceLastPost: number | null;
  topicSummary: string;
  recommendations: string[];
}

/** Summarize local post health for dashboard display. */
export function buildLocalPostsHealthReport(
  coverage: GbpLocalPostCoverage
): LocalPostsHealthReport {
  const topicSummary =
    coverage.topicTypesUsed.length > 0
      ? coverage.topicTypesUsed.map((type) => localPostTopicLabel(type)).join(" · ")
      : "none";

  return {
    overallScore: coverage.coverageScore,
    apiAvailable: coverage.apiAvailable,
    partialApi: coverage.partialApi,
    postCount: coverage.postCount,
    livePostCount: coverage.livePostCount,
    postsLast30Days: coverage.postsLast30Days,
    daysSinceLastPost: coverage.daysSinceLastPost,
    topicSummary,
    recommendations: coverage.recommendations,
  };
}
