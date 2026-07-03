import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  applyReviewReply,
  deleteReviewReply,
  getGbpReview,
  listGbpReviews,
} from "@/lib/google/gbp-reviews";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

/** List reviews or fetch a single review by reviewId query param. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("reviewId");

    if (reviewId) {
      const review = await getGbpReview(connection, reviewId);
      return NextResponse.json({ review });
    }

    const maxReviews = Number(searchParams.get("max") ?? "500");
    const reviews = await listGbpReviews(connection, {
      maxReviews: Number.isFinite(maxReviews) ? maxReviews : 500,
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reviews";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Post or update a review reply. */
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
      return NextResponse.json({ error: "GBP connection expired. Reconnect in Settings." }, { status: 401 });
    }

    const result = await applyReviewReply(connection, body.reviewId.trim(), body.comment);
    return NextResponse.json({ success: result.reviewReplyState !== "REJECTED", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post review reply";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Delete a review reply. */
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get("reviewId");
    if (!reviewId) {
      return NextResponse.json({ error: "reviewId query param is required" }, { status: 400 });
    }

    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    await deleteReviewReply(connection, reviewId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete review reply";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
