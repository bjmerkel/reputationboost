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
import { syncGoogleUpdatesForBusiness } from "@/lib/google/gbp-update-sync";
import { buildPubSubGbpEvent } from "@/lib/google/gbp-event-factory";
import { recordGbpEventAdmin } from "@/audit/storage-gbp-events";
import { enqueueEventRankPulse } from "@/audit/market/refresh-queue";
import { MARKET_REFRESH_FLAGS } from "@/lib/feature-flags";
import { isAdminSupabaseConfigured } from "@/lib/supabase/admin";

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
  let reviewText: string | undefined;
  let reviewId: string | null = null;
  let googleUpdateBusinessId: string | null = null;
  let googleUpdateSynced = false;
  let gbpEventId: string | null = null;

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

      const businessRecord = await findBusinessRecordByGbpLocation(payload.locationName);
      if (businessRecord) {
        const sync = await syncGoogleUpdatesForBusiness(businessRecord);
        googleUpdateSynced = Boolean(sync.audit);
      }
    } catch (error) {
      console.warn("[gbp-pubsub] google update event failed:", error);
    }
  }

  if (payload?.locationName && isAdminSupabaseConfigured()) {
    try {
      const businessRecord = await findBusinessRecordByGbpLocation(payload.locationName);
      if (businessRecord) {
        const parsedReviewId = payload.reviewName
          ? parseReviewIdFromReviewName(payload.reviewName)
          : null;

        if (parsedReviewId) {
          reviewId = parsedReviewId;
          try {
            const connection = await getValidGbpConnectionForRecord(businessRecord);
            if (connection) {
              const review = await getGbpReview(connection, parsedReviewId);
              if (!review.isAnonymous && review.reviewer) {
                reviewAuthor = review.reviewer;
              }
              if (review.rating > 0) {
                reviewRating = review.rating;
              }
              if (review.comment?.trim()) {
                reviewText = review.comment.trim();
              }
              reviewId = review.reviewId;
            }
          } catch (error) {
            console.warn("[gbp-pubsub] review prefetch failed:", error);
          }
        }
      }
    } catch (error) {
      console.warn("[gbp-pubsub] review prefetch failed:", error);
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
        const attribution = await attributeReviewToRecentOutreach({
          businessId: businessRecord.id,
          userId: businessRecord.user_id,
          reviewDetectedAt: envelope.message?.publishTime ?? new Date().toISOString(),
          reviewAuthor,
          reviewRating,
          reviewText,
          reviewId: reviewId ?? undefined,
          attributionMethod: "pubsub_review",
        });
        attributionId = attribution?.id ?? null;
      }
    } catch (error) {
      console.warn("[gbp-pubsub] outreach attribution failed:", error);
    }
  }

  if (payload?.locationName && isAdminSupabaseConfigured()) {
    try {
      const businessRecord = await findBusinessRecordByGbpLocation(payload.locationName);
      if (businessRecord) {
        const pubsubEvent = buildPubSubGbpEvent({
          businessId: businessRecord.id,
          userId: businessRecord.user_id,
          notificationType: payload.notificationType ?? "unknown",
          eventId,
          detectedAt: envelope.message?.publishTime ?? new Date().toISOString(),
          reviewRating,
          reviewAuthor,
          mediaItemName: payload.mediaItemName,
        });

        if (pubsubEvent) {
          const saved = await recordGbpEventAdmin(pubsubEvent);
          gbpEventId = saved?.id ?? null;
        }
      }
    } catch (error) {
      console.warn("[gbp-pubsub] gbp event persistence failed:", error);
    }
  }

  if (googleUpdateBusinessId) {
    const runAfter = new Date(
      envelope.message?.publishTime ?? Date.now()
    );
    runAfter.setUTCDate(
      runAfter.getUTCDate() + MARKET_REFRESH_FLAGS.eventDelayDays
    );
    await enqueueEventRankPulse({
      businessId: googleUpdateBusinessId,
      triggerSource: "gbp_event",
      triggerRef: eventId,
      runAfter: runAfter.toISOString(),
    }).catch((error) => {
      console.warn("[gbp-pubsub] delayed rank pulse scheduling failed:", error);
    });
  }

  return NextResponse.json({
    ok: true,
    eventId,
    notificationType: payload?.notificationType ?? null,
    attributionId,
    reviewAuthor: reviewAuthor ?? null,
    reviewRating: reviewRating ?? null,
    googleUpdateBusinessId,
    googleUpdateSynced,
    gbpEventId,
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
