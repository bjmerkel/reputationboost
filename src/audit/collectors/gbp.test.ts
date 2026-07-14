import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GbpConnection } from "../types";
import { listGbpReviewsWithSummary } from "@/lib/google/gbp-reviews";
import { shouldFetchConnectedPlacesFallback } from "./gbp";

const connection: GbpConnection = {
  businessId: "business-1",
  accountId: "account-1",
  locationId: "location-1",
  accessToken: "token",
  refreshToken: "refresh",
  expiresAt: new Date().toISOString(),
};

describe("connected GBP Places fallback policy", () => {
  it("does not use paid Place Details when GBP profile and reviews succeed", () => {
    assert.equal(
      shouldFetchConnectedPlacesFallback({
        profileAvailable: true,
        reviewsApiOk: true,
      }),
      false
    );
  });

  it("keeps Place Details as a resilience fallback for failed GBP reads", () => {
    assert.equal(
      shouldFetchConnectedPlacesFallback({
        profileAvailable: false,
        reviewsApiOk: true,
      }),
      true
    );
    assert.equal(
      shouldFetchConnectedPlacesFallback({
        profileAvailable: true,
        reviewsApiOk: false,
      }),
      true
    );
  });
});

describe("GBP review aggregates", () => {
  it("uses Google's total and average instead of the downloaded sample size", async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;

    globalThis.fetch = (async () => {
      requestCount += 1;
      return new Response(
        JSON.stringify({
          reviews: [
            {
              reviewId: `review-${requestCount}`,
              starRating: requestCount === 1 ? "FIVE" : "FOUR",
              createTime: "2026-07-01T00:00:00Z",
            },
          ],
          totalReviewCount: 732,
          averageRating: 4.8,
          nextPageToken: requestCount === 1 ? "next-page" : undefined,
        }),
        { status: 200 }
      );
    }) as typeof fetch;

    try {
      const result = await listGbpReviewsWithSummary(connection);
      assert.equal(requestCount, 2);
      assert.equal(result.reviews.length, 2);
      assert.equal(result.totalReviewCount, 732);
      assert.equal(result.averageRating, 4.8);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
