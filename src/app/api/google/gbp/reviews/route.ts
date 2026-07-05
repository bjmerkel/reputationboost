import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  analyzeGbpReviewCoverage,
  formatReviewCoverageSummary,
} from "@/lib/google/gbp-reviews-coverage";
import {
  applyReviewReply,
  deleteReviewReply,
  getGbpReview,
  listGbpReviews,
  probeReviewsApiAccess,
  REVIEWS_METHODS,
  STAR_RATINGS,
} from "@/lib/google/gbp-reviews";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

async function resolveConnection() {
  const user = await getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const business = await getPrimaryBusiness(user.id);
  if (!business?.gbpConnection) {
    return { error: NextResponse.json({ error: "GBP not connected" }, { status: 400 }) };
  }

  const connection = await getValidGbpConnection(user.id, business);
  if (!connection) {
    return { error: NextResponse.json({ error: "GBP connection expired" }, { status: 401 }) };
  }

  return { connection };
}

export async function GET(request: Request) {
  const resolved = await resolveConnection();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { connection } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "probe";

  try {
    if (mode === "list") {
      const maxReviews = Number(searchParams.get("max") ?? "500");
      const reviews = await listGbpReviews(connection, {
        maxReviews: Number.isFinite(maxReviews) ? maxReviews : 500,
      });
      return NextResponse.json({
        reviews,
        count: reviews.length,
        coverage: analyzeGbpReviewCoverage({ reviews }),
      });
    }

    if (mode === "get") {
      const reviewId = searchParams.get("reviewId");
      if (!reviewId) {
        return NextResponse.json({ error: "reviewId query parameter required" }, { status: 400 });
      }
      const review = await getGbpReview(connection, reviewId);
      return NextResponse.json({ review });
    }

    if (mode === "catalog") {
      return NextResponse.json({
        methods: REVIEWS_METHODS,
        starRatings: STAR_RATINGS,
      });
    }

    const probe = await probeReviewsApiAccess(connection);
    return NextResponse.json({
      ...probe,
      summary: probe.coverage ? formatReviewCoverageSummary(probe.coverage) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reviews API request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      reviewId?: string;
      comment?: string;
    };

    if (!body.reviewId?.trim()) {
      return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
    }
    if (!body.comment?.trim()) {
      return NextResponse.json({ error: "comment is required" }, { status: 400 });
    }

    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    const result = await applyReviewReply(connection, body.reviewId.trim(), body.comment);
    const reviews = await listGbpReviews(connection, { maxReviews: 100 });

    return NextResponse.json({
      success: result.reviewReplyState !== "REJECTED",
      ...result,
      coverage: analyzeGbpReviewCoverage({ reviews }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post review reply";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const resolved = await resolveConnection();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { connection } = resolved as Exclude<typeof resolved, { error: NextResponse }>;

  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("reviewId");
    if (!reviewId) {
      return NextResponse.json({ error: "reviewId query parameter required" }, { status: 400 });
    }

    await deleteReviewReply(connection, reviewId);
    const reviews = await listGbpReviews(connection, { maxReviews: 100 });

    return NextResponse.json({
      success: true,
      coverage: analyzeGbpReviewCoverage({ reviews }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete review reply";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
