import type { BusinessRecord } from "@/audit/businesses";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import {
  clearStaleScanManagedGbpEventsAdmin,
  recordGbpEventAdmin,
  touchModerationScanAtAdmin,
} from "@/audit/storage-gbp-events";
import type { FullAuditPayload } from "@/audit/types";
import type { RecordGbpEventInput } from "@/audit/types/gbp-events";
import { getValidGbpConnectionForRecord } from "@/lib/google/token-store";
import {
  enrichGbpLocationProfile,
  fetchGoogleUpdateState,
  getGbpLocationProfile,
} from "./gbp-location";
import { getGoogleDiffFields, getGooglePendingFields } from "./gbp-update-helpers";
import { listGbpLocalPosts } from "./gbp-local-posts";
import { listGbpReviews } from "./gbp-reviews";
import { isScanManagedExternalId } from "./gbp-event-ids";
import { planLinkForEventType, severityForEventType } from "./gbp-event-factory";

export type ModerationReconcileScope =
  | "google-updates"
  | "reviews"
  | "rejected-posts"
  | "audit";

type ScanSectionResult = "ok" | "skipped";

export { isScanManagedExternalId };

function reviewIsNewSince(reviewCreateTime: string, sinceIso: string): boolean {
  return new Date(reviewCreateTime).getTime() > new Date(sinceIso).getTime();
}

function baseEvent(
  record: BusinessRecord,
  partial: Omit<RecordGbpEventInput, "businessId" | "userId" | "source">
): RecordGbpEventInput {
  const plan = partial.planStepNumber
    ? { planStepNumber: partial.planStepNumber, planScrollTarget: partial.planScrollTarget }
    : planLinkForEventType(partial.eventType);

  return {
    businessId: record.id,
    userId: record.user_id,
    source: "nightly",
    severity: partial.severity ?? severityForEventType(partial.eventType),
    ...plan,
    ...partial,
  };
}

/** Whether a scan-managed external id belongs to a successfully scanned scope. */
export function externalIdInReconcileScopes(
  externalId: string,
  scopes: Iterable<ModerationReconcileScope>
): boolean {
  const scopeSet = scopes instanceof Set ? scopes : new Set(scopes);

  if (scopeSet.has("google-updates")) {
    if (
      externalId.startsWith("nightly:conflict:") ||
      externalId.startsWith("nightly:pending:") ||
      externalId === "nightly:duplicate-location" ||
      externalId === "nightly:voice-of-merchant"
    ) {
      return true;
    }
  }

  if (scopeSet.has("reviews")) {
    if (
      externalId.startsWith("nightly:negative-review:") ||
      externalId.startsWith("nightly:rejected-reply:") ||
      externalId.startsWith("nightly:pending-reply:") ||
      externalId === "nightly:unresponded-negative"
    ) {
      return true;
    }
  }

  if (scopeSet.has("rejected-posts") && externalId === "nightly:rejected-posts") {
    return true;
  }

  if (scopeSet.has("audit") && externalId === "audit:customer-media") {
    return true;
  }

  // Legacy count-suffixed ids from earlier builds — clear when parent scope ran.
  if (scopeSet.has("rejected-posts") && externalId.startsWith("audit:rejected-posts")) {
    return true;
  }
  if (scopeSet.has("audit") && externalId.startsWith("audit:customer-media:")) {
    return true;
  }
  if (
    scopeSet.has("reviews") &&
    externalId.startsWith("nightly:unresponded-negative:")
  ) {
    return true;
  }

  return false;
}

async function scanGoogleUpdates(
  record: BusinessRecord,
  audit: FullAuditPayload,
  events: RecordGbpEventInput[]
): Promise<ScanSectionResult> {
  const connection = await getValidGbpConnectionForRecord(record);
  if (!connection) return "skipped";

  const profile = await enrichGbpLocationProfile(connection, await getGbpLocationProfile(connection));
  const googleUpdateState = await fetchGoogleUpdateState(connection, profile);
  const patchedAudit: FullAuditPayload = {
    ...audit,
    gbp: {
      ...audit.gbp,
      googleUpdateState,
      hasGoogleUpdated: profile.hasGoogleUpdated,
    },
  };

  for (const field of getGoogleDiffFields(patchedAudit)) {
    events.push(
      baseEvent(record, {
        eventType: "GOOGLE_UPDATE",
        title: "Google profile conflict",
        message: `Google suggested a different value for ${field.label}. Resolve in Take Action.`,
        externalId: `nightly:conflict:${field.field}`,
        payload: { field: field.field, label: field.label },
      })
    );
  }

  for (const field of getGooglePendingFields(patchedAudit)) {
    events.push(
      baseEvent(record, {
        eventType: "GOOGLE_UPDATE",
        severity: "info",
        title: "Google is processing an edit",
        message: `${field.label} is still processing on Google. Check back soon or review in Take Action.`,
        externalId: `nightly:pending:${field.field}`,
        payload: { field: field.field, label: field.label, pending: true },
      })
    );
  }

  if (profile.duplicateLocation) {
    events.push(
      baseEvent(record, {
        eventType: "DUPLICATE_LOCATION",
        title: "Duplicate listing detected",
        message:
          "Google flagged a possible duplicate location. Resolve this in Business Profile Manager or Take Action.",
        externalId: `nightly:duplicate-location`,
        payload: { duplicateLocation: profile.duplicateLocation },
      })
    );
  }

  if (!profile.hasVoiceOfMerchant) {
    events.push(
      baseEvent(record, {
        eventType: "VOICE_OF_MERCHANT_UPDATED",
        title: "Voice of Merchant issue",
        message:
          "Your profile may be suspended or limited in search. Check verification and policy status in Google.",
        externalId: `nightly:voice-of-merchant`,
        payload: { hasVoiceOfMerchant: false },
      })
    );
  }

  return "ok";
}

async function scanReviews(
  record: BusinessRecord,
  audit: FullAuditPayload,
  events: RecordGbpEventInput[]
): Promise<ScanSectionResult> {
  const connection = await getValidGbpConnectionForRecord(record);
  if (!connection) return "skipped";

  const reviews = await listGbpReviews(connection, { maxReviews: 100 });
  const since = audit.completedAt;

  for (const review of reviews) {
    if (reviewIsNewSince(review.createTime, since) && review.rating <= 3) {
      events.push(
        baseEvent(record, {
          eventType: "NEGATIVE_REVIEW",
          title: "New negative review",
          message: `${review.rating}★ review from ${review.reviewer || "a customer"} needs a response.`,
          externalId: `nightly:negative-review:${review.reviewId}`,
          payload: {
            reviewId: review.reviewId,
            rating: review.rating,
            author: review.reviewer,
          },
        })
      );
    }

    if (review.reviewReply?.reviewReplyState === "REJECTED") {
      const wasRejectedAtAudit =
        audit.reviews.reviews?.some(
          (r) => r.id === review.reviewId && r.replyState === "REJECTED"
        ) ?? false;
      if (!wasRejectedAtAudit) {
        events.push(
          baseEvent(record, {
            eventType: "REJECTED_REPLY",
            title: "Review reply rejected",
            message: `Google rejected your reply to ${review.reviewer || "a customer"}. Revise and republish in Take Action.`,
            externalId: `nightly:rejected-reply:${review.reviewId}`,
            payload: {
              reviewId: review.reviewId,
              policyViolation: review.reviewReply.policyViolation,
            },
          })
        );
      }
    }

    if (review.reviewReply?.reviewReplyState === "PENDING") {
      events.push(
        baseEvent(record, {
          eventType: "PENDING_REPLY",
          severity: "info",
          title: "Reply awaiting moderation",
          message: `Your reply to ${review.reviewer || "a customer"} is pending Google review.`,
          externalId: `nightly:pending-reply:${review.reviewId}`,
          payload: { reviewId: review.reviewId },
        })
      );
    }
  }

  const unrespondedNegative = reviews.filter(
    (review) => review.rating <= 3 && !review.reviewReply?.comment
  );
  if (unrespondedNegative.length > audit.reviews.unrespondedNegative) {
    events.push(
      baseEvent(record, {
        eventType: "UNRESPONDED_NEGATIVE",
        title: "Unresponded negative reviews",
        message: `${unrespondedNegative.length} negative review${unrespondedNegative.length === 1 ? "" : "s"} still need a response.`,
        externalId: `nightly:unresponded-negative`,
        payload: { count: unrespondedNegative.length },
      })
    );
  }

  return "ok";
}

async function scanRejectedPosts(
  record: BusinessRecord,
  audit: FullAuditPayload,
  events: RecordGbpEventInput[]
): Promise<ScanSectionResult> {
  const connection = await getValidGbpConnectionForRecord(record);
  if (!connection) return "skipped";

  let rejectedPosts: number;
  try {
    const posts = await listGbpLocalPosts(connection);
    rejectedPosts = posts.filter((post) => post.state === "REJECTED").length;
  } catch {
    // Live list failed — keep prior audit signal rather than clearing blindly.
    rejectedPosts = audit.gbp.localPosts?.rejectedPostCount ?? 0;
    if (rejectedPosts > 0) {
      events.push(
        baseEvent(record, {
          eventType: "REJECTED_POST",
          title: "Google post rejected",
          message: `${rejectedPosts} Google post${rejectedPosts === 1 ? " was" : "s were"} rejected — revise content and republish.`,
          externalId: `nightly:rejected-posts`,
          payload: { rejectedPostCount: rejectedPosts, source: "audit-fallback" },
        })
      );
    }
    return "skipped";
  }

  if (rejectedPosts > 0) {
    events.push(
      baseEvent(record, {
        eventType: "REJECTED_POST",
        title: "Google post rejected",
        message: `${rejectedPosts} Google post${rejectedPosts === 1 ? " was" : "s were"} rejected — revise content and republish.`,
        externalId: `nightly:rejected-posts`,
        payload: { rejectedPostCount: rejectedPosts },
      })
    );
  }

  return "ok";
}

function scanAuditModeration(record: BusinessRecord, audit: FullAuditPayload, events: RecordGbpEventInput[]) {
  const customerShare = audit.gbp.content.mediaCoverage?.customerPhotoShare ?? 0;
  if (customerShare >= 60) {
    events.push(
      baseEvent(record, {
        eventType: "CUSTOMER_MEDIA_DOMINANCE",
        title: "Customer photos dominate gallery",
        message: `${customerShare}% of visible photos are from customers. Upload owner photos in Take Action.`,
        externalId: `audit:customer-media`,
        payload: { customerPhotoShare: customerShare },
      })
    );
  }
}

/** External ids currently present after a scan pass (for stale-alert reconcile). */
export function scanManagedExternalIds(events: Array<{ externalId?: string }>): string[] {
  return events
    .map((event) => event.externalId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export interface ModerationScanResult {
  businessId: string;
  eventsRecorded: number;
  eventsCleared: number;
  errors: string[];
}

/** Nightly moderation scan: live Google state + review moderation vs last audit. */
export async function scanBusinessModeration(record: BusinessRecord): Promise<ModerationScanResult> {
  const result: ModerationScanResult = {
    businessId: record.id,
    eventsRecorded: 0,
    eventsCleared: 0,
    errors: [],
  };

  const audit = await loadLatestAuditForBusinessAdmin(
    record.user_id,
    record.id,
    record.slug,
    record.name
  );
  if (!audit) return result;

  const pendingEvents: RecordGbpEventInput[] = [];
  const reconcileScopes = new Set<ModerationReconcileScope>();

  try {
    const section = await scanGoogleUpdates(record, audit, pendingEvents);
    if (section === "ok") reconcileScopes.add("google-updates");
  } catch (error) {
    result.errors.push(
      `google-updates: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    const section = await scanReviews(record, audit, pendingEvents);
    if (section === "ok") reconcileScopes.add("reviews");
  } catch (error) {
    result.errors.push(`reviews: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const section = await scanRejectedPosts(record, audit, pendingEvents);
    if (section === "ok") reconcileScopes.add("rejected-posts");
  } catch (error) {
    result.errors.push(`rejected-posts: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    scanAuditModeration(record, audit, pendingEvents);
    reconcileScopes.add("audit");
  } catch (error) {
    result.errors.push(`audit: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const event of pendingEvents) {
    try {
      await recordGbpEventAdmin(event);
      result.eventsRecorded += 1;
    } catch (error) {
      result.errors.push(
        `record:${event.externalId ?? event.eventType}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (reconcileScopes.size > 0) {
    try {
      result.eventsCleared = await clearStaleScanManagedGbpEventsAdmin(
        record.id,
        scanManagedExternalIds(pendingEvents),
        {
          shouldClearExternalId: (externalId) =>
            externalIdInReconcileScopes(externalId, reconcileScopes),
        }
      );
    } catch (error) {
      result.errors.push(
        `reconcile: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  await touchModerationScanAtAdmin(record.id);
  return result;
}
