import type {
  GbpEventSeverity,
  GbpEventType,
  RecordGbpEventInput,
} from "@/audit/types/gbp-events";
import type { GbpNotificationType } from "./gbp-notifications";
import { notificationTypeLabel } from "./gbp-notifications";
import { GOOGLE_UPDATES_STEP_NUMBER } from "./gbp-update-helpers";

export function severityForEventType(eventType: GbpEventType): GbpEventSeverity {
  switch (eventType) {
    case "DUPLICATE_LOCATION":
    case "REJECTED_REPLY":
    case "UNRESPONDED_NEGATIVE":
      return "critical";
    case "GOOGLE_UPDATE":
    case "NEGATIVE_REVIEW":
    case "REJECTED_POST":
    case "PENDING_REPLY":
    case "VOICE_OF_MERCHANT_UPDATED":
      return "warning";
    default:
      return "info";
  }
}

export function planLinkForEventType(eventType: GbpEventType): {
  planStepNumber?: number;
  planScrollTarget?: "google-updates";
} {
  switch (eventType) {
    case "GOOGLE_UPDATE":
      return { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER, planScrollTarget: "google-updates" };
    case "NEW_REVIEW":
    case "UPDATED_REVIEW":
    case "NEGATIVE_REVIEW":
    case "UNRESPONDED_NEGATIVE":
    case "REJECTED_REPLY":
    case "PENDING_REPLY":
      return { planStepNumber: 11 };
    case "NEW_CUSTOMER_MEDIA":
    case "CUSTOMER_MEDIA_DOMINANCE":
      return { planStepNumber: 6 };
    case "REJECTED_POST":
      return { planStepNumber: 8 };
    case "DUPLICATE_LOCATION":
    case "VOICE_OF_MERCHANT_UPDATED":
      return { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER, planScrollTarget: "google-updates" };
    default:
      return {};
  }
}

export function eventTypeFromNotificationType(
  notificationType?: string
): GbpEventType | null {
  if (!notificationType) return null;
  const normalized = notificationType.toUpperCase();

  if (normalized === "GOOGLE_UPDATE") return "GOOGLE_UPDATE";
  if (normalized === "NEW_REVIEW") return "NEW_REVIEW";
  if (normalized === "UPDATED_REVIEW") return "UPDATED_REVIEW";
  if (normalized === "NEW_CUSTOMER_MEDIA") return "NEW_CUSTOMER_MEDIA";
  if (normalized === "DUPLICATE_LOCATION") return "DUPLICATE_LOCATION";
  if (normalized === "VOICE_OF_MERCHANT_UPDATED") return "VOICE_OF_MERCHANT_UPDATED";

  return null;
}

export function buildPubSubGbpEvent(input: {
  businessId: string;
  userId: string;
  notificationType: string;
  eventId: string;
  detectedAt?: string;
  reviewRating?: number;
  reviewAuthor?: string;
  mediaItemName?: string;
}): RecordGbpEventInput | null {
  const eventType = eventTypeFromNotificationType(input.notificationType);
  if (!eventType) return null;

  const label = notificationTypeLabel(input.notificationType as GbpNotificationType);
  const plan = planLinkForEventType(eventType);
  const severity = severityForEventType(eventType);

  let title = label;
  let message = `Google sent a ${label.toLowerCase()} alert for your Business Profile.`;

  if (eventType === "NEW_REVIEW" || eventType === "UPDATED_REVIEW") {
    const stars = input.reviewRating ? `${input.reviewRating}★` : "a new";
    const author = input.reviewAuthor ? ` from ${input.reviewAuthor}` : "";
    title = eventType === "NEW_REVIEW" ? "New Google review" : "Review updated";
    message = `${stars} review${author}. Respond in Take Action to protect your reputation score.`;
    if (input.reviewRating != null && input.reviewRating <= 3) {
      return {
        businessId: input.businessId,
        userId: input.userId,
        eventType: "NEGATIVE_REVIEW",
        severity: "warning",
        source: "pubsub",
        title: "Negative review needs response",
        message,
        externalId: `pubsub:${input.eventId}`,
        payload: {
          reviewRating: input.reviewRating,
          reviewAuthor: input.reviewAuthor,
          notificationType: input.notificationType,
        },
        ...planLinkForEventType("NEGATIVE_REVIEW"),
        detectedAt: input.detectedAt,
      };
    }
  }

  if (eventType === "NEW_CUSTOMER_MEDIA" && input.mediaItemName) {
    message = "A customer uploaded new media to your profile. Review it before it dominates your gallery.";
  }

  return {
    businessId: input.businessId,
    userId: input.userId,
    eventType,
    severity,
    source: "pubsub",
    title,
    message,
    externalId: `pubsub:${input.eventId}`,
    payload: {
      notificationType: input.notificationType,
      reviewRating: input.reviewRating,
      reviewAuthor: input.reviewAuthor,
      mediaItemName: input.mediaItemName,
    },
    ...plan,
    detectedAt: input.detectedAt,
  };
}
