import type { GbpLocalPost } from "./gbp-local-posts";
import { localPostActionLabel, localPostTopicLabel } from "./gbp-local-posts";

export interface GbpLocalPostCoverage {
  apiAvailable: boolean;
  partialApi: boolean;
  coverageScore: number;
  postCount: number;
  livePostCount: number;
  rejectedPostCount: number;
  processingPostCount: number;
  postsLast30Days: number;
  daysSinceLastPost: number | null;
  topicTypesUsed: string[];
  hasOfferPost: boolean;
  hasEventPost: boolean;
  hasCallToActionPosts: boolean;
  hasMediaPosts: boolean;
  totalViews: number | null;
  endpoints: {
    list: string;
    insights: string;
  };
  recommendations: string[];
}

const RECOMMENDED_POSTS_PER_MONTH = 4;
const STALE_POST_DAYS = 14;

function endpointLabel(status?: string): string {
  return status ?? "skipped";
}

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function postsInLastDays(posts: GbpLocalPost[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return posts.filter((post) => {
    const created = post.createTime ? new Date(post.createTime).getTime() : 0;
    return created >= cutoff;
  }).length;
}

function extractTotalViews(
  insights?: Array<{ localPostName: string; metricValues: Array<{ totalValue?: { value?: string } }> }>
): number | null {
  if (!insights?.length) return null;
  let total = 0;
  let found = false;
  for (const entry of insights) {
    for (const metric of entry.metricValues ?? []) {
      const value = Number(metric.totalValue?.value ?? NaN);
      if (!Number.isNaN(value)) {
        total += value;
        found = true;
      }
    }
  }
  return found ? total : null;
}

/** Score how fully local posts are configured and maintained for a location. */
export function analyzeGbpLocalPostCoverage(input: {
  posts: GbpLocalPost[];
  insights?: Array<{ localPostName: string; metricValues: Array<{ totalValue?: { value?: string } }> }>;
  probe?: {
    endpoints?: { list?: string; insights?: string };
    partial?: boolean;
  };
}): GbpLocalPostCoverage {
  const posts = input.posts;
  const livePosts = posts.filter((post) => post.state === "LIVE" || !post.state);
  const rejectedPosts = posts.filter((post) => post.state === "REJECTED");
  const processingPosts = posts.filter((post) => post.state === "PROCESSING");
  const sorted = [...posts].sort(
    (a, b) => new Date(b.createTime ?? 0).getTime() - new Date(a.createTime ?? 0).getTime()
  );
  const daysSinceLastPost = daysSince(sorted[0]?.createTime);
  const postsLast30Days = postsInLastDays(posts, 30);
  const topicTypesUsed = [...new Set(posts.map((post) => post.topicType).filter(Boolean))];

  const hasOfferPost = posts.some((post) => post.topicType === "OFFER");
  const hasEventPost = posts.some((post) => post.topicType === "EVENT");
  const hasCallToActionPosts = livePosts.some(
    (post) => Boolean(post.callToAction?.actionType) && post.topicType !== "OFFER"
  );
  const hasMediaPosts = livePosts.some((post) => (post.media?.length ?? 0) > 0);
  const totalViews = extractTotalViews(input.insights);

  const apiAvailable =
    input.probe?.endpoints?.list === "ok" || posts.length > 0 || input.probe === undefined;

  let coverageScore = 0;
  if (apiAvailable) coverageScore += 25;
  if (livePosts.length > 0) coverageScore += 20;
  if (daysSinceLastPost !== null && daysSinceLastPost <= STALE_POST_DAYS) coverageScore += 25;
  if (postsLast30Days >= 2) coverageScore += 15;
  if (hasCallToActionPosts || hasOfferPost) coverageScore += 10;
  if (topicTypesUsed.length >= 2) coverageScore += 5;

  const recommendations: string[] = [];
  if (!apiAvailable) {
    recommendations.push("Reconnect GBP with a manager account that has Local Posts API access.");
  } else {
    if (livePosts.length === 0) {
      recommendations.push("Publish your first Google Post — updates boost relevance in Maps search.");
    } else if (daysSinceLastPost !== null && daysSinceLastPost > STALE_POST_DAYS) {
      recommendations.push(
        `Last post was ${daysSinceLastPost} days ago — aim for at least weekly updates.`
      );
    }
    if (postsLast30Days < RECOMMENDED_POSTS_PER_MONTH / 2) {
      recommendations.push(
        `Only ${postsLast30Days} post${postsLast30Days === 1 ? "" : "s"} in 30 days — target ${RECOMMENDED_POSTS_PER_MONTH}+ per month.`
      );
    }
    if (!hasCallToActionPosts && !hasOfferPost && livePosts.length > 0) {
      recommendations.push("Add call-to-action buttons (Book, Learn more, Call) to drive conversions.");
    }
    if (!hasEventPost && !hasOfferPost && livePosts.length >= 3) {
      recommendations.push("Mix in an event or offer post to highlight promotions.");
    }
    if (rejectedPosts.length > 0) {
      recommendations.push(
        `${rejectedPosts.length} post${rejectedPosts.length === 1 ? "" : "s"} rejected — review Google's content policies and republish.`
      );
    }
  }

  return {
    apiAvailable,
    partialApi:
      input.probe?.partial ??
      Boolean(
        input.probe?.endpoints &&
          input.probe.endpoints.list === "ok" &&
          input.probe.endpoints.insights &&
          input.probe.endpoints.insights !== "ok"
      ),
    coverageScore: Math.min(100, coverageScore),
    postCount: posts.length,
    livePostCount: livePosts.length,
    rejectedPostCount: rejectedPosts.length,
    processingPostCount: processingPosts.length,
    postsLast30Days,
    daysSinceLastPost,
    topicTypesUsed,
    hasOfferPost,
    hasEventPost,
    hasCallToActionPosts,
    hasMediaPosts,
    totalViews,
    endpoints: {
      list: endpointLabel(input.probe?.endpoints?.list),
      insights: endpointLabel(input.probe?.endpoints?.insights),
    },
    recommendations: recommendations.slice(0, 5),
  };
}

export function formatLocalPostCoverageSummary(coverage: GbpLocalPostCoverage): string {
  if (!coverage.apiAvailable) return "unavailable";
  if (coverage.livePostCount === 0) return "no posts";
  const parts = [`${coverage.livePostCount} live`];
  if (coverage.daysSinceLastPost !== null) {
    parts.push(`last ${coverage.daysSinceLastPost}d ago`);
  }
  return parts.join(" · ");
}

export function formatLocalPostPreview(post: GbpLocalPost): string {
  const topic = localPostTopicLabel(post.topicType);
  const action = post.callToAction?.actionType
    ? localPostActionLabel(post.callToAction.actionType)
    : null;
  return action ? `${topic} · ${action}` : topic;
}
