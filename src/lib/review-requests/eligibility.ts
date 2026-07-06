import type { FullAuditPayload } from "@/audit/types";
import type { CustomerRecord } from "@/lib/customers/types";
import { isTriggerEvent } from "@/lib/integrations/normalize-webhook-payload";

export const REVIEW_REQUEST_COOLDOWN_DAYS = 90;

export const BLOCKED_REVIEW_EVENTS = new Set([
  "estimate.sent",
  "estimate.created",
  "lead.created",
  "quote.sent",
  "appointment.scheduled",
]);

export type IneligibilityReason =
  | "customer_opted_out"
  | "already_requested"
  | "cooldown_active"
  | "blocked_event_type"
  | "auto_send_disabled"
  | "no_review_gap"
  | "negative_sentiment";

export interface ReviewRequestEligibilityInput {
  customer: CustomerRecord;
  eventType?: string;
  explicitSend?: boolean;
  autoSend?: boolean;
  triggerEvents?: string[];
  auditHasReviewGap?: boolean;
  /** Manual sends from the UI bypass audit gap checks. */
  manualSend?: boolean;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface ReviewRequestEligibilityResult {
  eligible: boolean;
  reason?: IneligibilityReason;
}

export function auditHasReviewGap(audit: FullAuditPayload | null): boolean {
  if (!audit) return true;
  return (audit.strategy?.gaps ?? []).some((gap) => gap.id.startsWith("review-gap"));
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function isWithinCooldown(customer: CustomerRecord): boolean {
  if (!customer.review_requested_at) return false;
  return daysSince(customer.review_requested_at) < REVIEW_REQUEST_COOLDOWN_DAYS;
}

export function evaluateReviewRequestEligibility(
  input: ReviewRequestEligibilityInput
): ReviewRequestEligibilityResult {
  const { customer } = input;

  if (customer.opted_out) {
    return { eligible: false, reason: "customer_opted_out" };
  }

  if (input.sentiment === "negative") {
    return { eligible: false, reason: "negative_sentiment" };
  }

  if (input.eventType && BLOCKED_REVIEW_EVENTS.has(input.eventType.trim().toLowerCase())) {
    return { eligible: false, reason: "blocked_event_type" };
  }

  if (isWithinCooldown(customer)) {
    return { eligible: false, reason: "cooldown_active" };
  }

  const explicitSend = input.explicitSend === true;
  const autoSend =
    input.autoSend === true &&
    input.eventType &&
    input.triggerEvents &&
    isTriggerEvent(input.eventType, input.triggerEvents);

  if (!explicitSend && !autoSend && !input.manualSend) {
    return { eligible: false, reason: "auto_send_disabled" };
  }

  if (!input.manualSend && !explicitSend && input.auditHasReviewGap === false) {
    return { eligible: false, reason: "no_review_gap" };
  }

  return { eligible: true };
}

export function ineligibilityMessage(reason: IneligibilityReason): string {
  switch (reason) {
    case "customer_opted_out":
      return "Customer has opted out of messages.";
    case "already_requested":
      return "A review was already requested for this customer.";
    case "cooldown_active":
      return `Review request sent within the last ${REVIEW_REQUEST_COOLDOWN_DAYS} days.`;
    case "blocked_event_type":
      return "This event type is not eligible for review requests.";
    case "auto_send_disabled":
      return "Auto-send is off and no explicit send was requested.";
    case "no_review_gap":
      return "Audit shows review count is healthy — auto-send skipped.";
    case "negative_sentiment":
      return "Negative customer sentiment — review request skipped.";
    default:
      return "Customer is not eligible for a review request.";
  }
}
