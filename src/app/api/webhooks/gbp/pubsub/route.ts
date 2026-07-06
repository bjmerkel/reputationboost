import { NextResponse } from "next/server";
import { createId } from "@/lib/create-id";
import { getGbpReview } from "@/lib/google/gbp-reviews";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";
import {
  attributeReviewToRecentOutreach,
  findBusinessRecordByGbpLocation,
  parseReviewIdFromReviewName,
} from "@/lib/review-requests/attribution";
import { recordGbpGoogleUpdateEvent } from "@/lib/google/gbp-update-events";

interface PubSubPushEnvelope {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
}

export interface GbpPubSubNotification {
  notificationType?: string;
  locationName?: string;
  reviewName?: string;
  mediaItemName?: string;
  accountName?: string;
}

function decodePubSubData(data?: string): GbpPubSubNotification | null {
  if (!data) return null;
  try {
    const json = Buffer.from(data, "base64").toString("utf8");
    return JSON.parse(json) as GbpPubSubNotification;
  } catch {
    return null;
  }
}

function isReviewNotification(type: string | undefined): boolean {
  if (!type) return false;
  return type.toUpperCase().includes("REVIEW");
}

function isGoogleUpdateNotification(type: string | undefined): boolean {
  if (!type) return false;
  return type.toUpperCase() === "GOOGLE_UPDATE";
}

/** Receive Google Business Profile Pub/Sub push notifications. */
export async function POST(request: Request) {
  const token = process.env.GBP_PUBSUB_VERIFICATION_TOKEN?.trim();
  if (token) {
    const auth = request.headers.get("authorization");
    const queryToken = new URL(request.url).searchParams.get("token");
    if (auth !== `Bearer ${token}` && queryToken !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let envelope: PubSubPushEnvelope;
  try {
    envelope = (await request.json()) as PubSubPushEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = decodePubSubData(envelope.message?.data);
  const eventId = envelope.message?.messageId ?? createId();

  console.info("[gbp-pubsub]", {
    eventId,
    type: payload?.notificationType ?? "unknown",
    location: payload?.locationName,
    subscription: envelope.subscription,
  });

  let attributionId: string | null = null;
  let reviewAuthor: string | undefined;
  let reviewRating: number | undefined;
  let googleUpdateBusinessId: string | null = null;

  if (
    isGoogleUpdateNotification(payload?.notificationType) &&
    payload?.locationName &&
    isAdminSupabaseConfigured()
  ) {
    try {
      const recorded = await recordGbpGoogleUpdateEvent(payload.locationName, {
        detectedAt: envelope.message?.publishTime ?? new Date().toISOString(),
        eventId,
      });
      googleUpdateBusinessId = recorded?.businessId ?? null;
    } catch (error) {
      console.warn("[gbp-pubsub] google update event failed:", error);
    }
  }

  if (
    isReviewNotification(payload?.notificationType) &&
    payload?.locationName &&
    isAdminSupabaseConfigured()
  ) {
    try {
      const businessRecord = await findBusinessRecordByGbpLocation(payload.locationName);
      if (businessRecord) {
        const reviewId = payload.reviewName
          ? parseReviewIdFromReviewName(payload.reviewName)
          : null;

        if (reviewId) {
          try {
            const connection = await getValidGbpConnectionForRecord(businessRecord);
            if (connection) {
              const review = await getGbpReview(connection, reviewId);
              if (!review.isAnonymous && review.reviewer) {
                reviewAuthor = review.reviewer;
              }
              if (review.rating > 0) {
                reviewRating = review.rating;
              }
            }
          } catch (error) {
            console.warn("[gbp-pubsub] review fetch failed, using time-window attribution:", error);
          }
        }

        const attribution = await attributeReviewToRecentOutreach({
          businessId: businessRecord.id,
          userId: businessRecord.user_id,
          reviewDetectedAt: envelope.message?.publishTime ?? new Date().toISOString(),
          reviewAuthor,
          reviewRating,
          attributionMethod: "pubsub_review",
        });
        attributionId = attribution?.id ?? null;
      }
    } catch (error) {
      console.warn("[gbp-pubsub] outreach attribution failed:", error);
    }
  }

  return NextResponse.json({
    ok: true,
    eventId,
    notificationType: payload?.notificationType ?? null,
    attributionId,
    reviewAuthor: reviewAuthor ?? null,
    reviewRating: reviewRating ?? null,
    googleUpdateBusinessId,
  });
}

/** Pub/Sub subscription verification handshake. */
export async function GET(request: Request) {
  const challenge = new URL(request.url).searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ status: "gbp-pubsub-receiver" });
}
