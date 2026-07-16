import type { Phase1AuditPayload, ReviewRecord } from "@/audit/types";
import type { PolicyClassification } from "./policy-classifier";
import { POLICY_VIOLATION_DESCRIPTIONS, POLICY_VIOLATION_LABELS } from "./types";

export function buildDisputeEvidenceTemplate(
  audit: Phase1AuditPayload,
  review: ReviewRecord,
  classification: PolicyClassification
): string {
  const violationLabel = POLICY_VIOLATION_LABELS[classification.violation];
  const violationDescription = POLICY_VIOLATION_DESCRIPTIONS[classification.violation];
  const reviewDate = new Date(review.publishedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return [
    `Business: ${audit.clientName}`,
    `Address: ${audit.gbp.identity.address}`,
    `Review date: ${reviewDate}`,
    `Reviewer: ${review.isAnonymous ? "Anonymous" : review.author}`,
    `Rating: ${review.rating}★`,
    "",
    `Dispute category: ${violationLabel}`,
    `Google policy: ${violationDescription}`,
    `Why we flagged this: ${classification.reason}`,
    "",
    "Review text:",
    `"${review.text || "(no text provided)"}"`,
    "",
    "Evidence / context for Google:",
    "- [Add customer records, invoices, or CRM notes showing this person was not a customer]",
    "- [Add screenshots or documentation supporting your claim]",
    "",
    "Requested action: Remove this review for violating Google Maps User Contributed Content policies.",
  ].join("\n");
}
