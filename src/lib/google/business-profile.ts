import type { GbpConnection } from "@/audit/types";
import {
  fetchGbpPerformanceData,
  type GbpPerformanceData,
} from "./gbp-performance";
import { fetchGbpMediaSummary, type GbpMediaSummary } from "./gbp-media";
import { listGbpLocalPosts, type GbpLocalPost } from "./gbp-local-posts";
import {
  listGbpReviewsWithSummary,
  type GbpReview,
  type GbpReviewList,
} from "./gbp-reviews";

export type { GbpReview } from "./gbp-reviews";
export type { GbpLocalPost } from "./gbp-local-posts";

export type GbpPerformanceMetrics = GbpPerformanceData;
export interface GbpEnrichment {
  performance: GbpPerformanceMetrics;
  posts: GbpLocalPost[];
  postsApiOk: boolean;
  reviews: GbpReview[];
  reviewSummary: Pick<GbpReviewList, "totalReviewCount" | "averageRating">;
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
  const reviewsPromise = listGbpReviewsWithSummary(connection)
    .then((result) => {
      reviewsApiOk = true;
      return result;
    })
    .catch(
      () =>
        ({
          reviews: [],
          totalReviewCount: 0,
          averageRating: 0,
        }) satisfies GbpReviewList
    );

  const [performance, posts, reviewList, media] = await Promise.all([
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

  return {
    performance,
    posts,
    postsApiOk,
    reviews: reviewList.reviews,
    reviewSummary: {
      totalReviewCount: reviewList.totalReviewCount,
      averageRating: reviewList.averageRating,
    },
    reviewsApiOk,
    media,
  };
}
