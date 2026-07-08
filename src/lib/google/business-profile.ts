import type { GbpConnection } from "@/audit/types";
import {
  fetchGbpPerformanceData,
  type GbpPerformanceData,
} from "./gbp-performance";
import { fetchGbpMediaSummary, type GbpMediaSummary } from "./gbp-media";
import { listGbpLocalPosts, type GbpLocalPost } from "./gbp-local-posts";
import { listGbpReviews, type GbpReview } from "./gbp-reviews";
import { authHeadersForConnection } from "./token-store";

export type { GbpReview } from "./gbp-reviews";
export type { GbpLocalPost } from "./gbp-local-posts";

export type GbpPerformanceMetrics = GbpPerformanceData;
export interface GbpEnrichment {
  performance: GbpPerformanceMetrics;
  posts: GbpLocalPost[];
  postsApiOk: boolean;
  reviews: GbpReview[];
  reviewsApiOk: boolean;
  media: GbpMediaSummary;
}

/** Full GBP management data using per-business OAuth connection. */
export async function fetchGbpEnrichment(
  connection: GbpConnection,
  options?: { userEmail?: string }
): Promise<GbpEnrichment> {
  let postsApiOk = false;
  const postsPromise = listGbpLocalPosts(connection)
    .then((items) => {
      postsApiOk = true;
      return items;
    })
    .catch(() => [] as GbpLocalPost[]);

  let reviewsApiOk = false;
  const reviewsPromise = listGbpReviews(connection)
    .then((items) => {
      reviewsApiOk = true;
      return items;
    })
    .catch(() => [] as GbpReview[]);

  const [performance, posts, reviews, media] = await Promise.all([
    fetchGbpPerformanceData(connection, 30, { platformEmail: options?.userEmail }),
    postsPromise,
    reviewsPromise,
    fetchGbpMediaSummary(connection).catch(() => ({
      photoCount: 0,
      videoCount: 0,
      photosByType: {},
      lastPhotoUpload: null,
      totalMediaItemCount: 0,
      items: [],
    })),
  ]);

  return { performance, posts, postsApiOk, reviews, reviewsApiOk, media };
}
