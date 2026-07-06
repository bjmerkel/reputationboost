import type { GbpConnection } from "@/audit/types";
import {
  descriptionsMatch,
  GBP_DESCRIPTION_FIELD,
  sanitizeGbpDescriptionForPublish,
} from "./gbp-description";
import { maskIncludesField } from "./gbp-google-updated";
import { getGbpLocationProfile, getGoogleUpdatedSnapshot } from "./gbp-location";

/**
 * Review status of a profile edit, mirroring Google's lifecycle
 * (https://support.google.com/business — "Understand what happens to your
 * Business Profile edits"): Accepted, Pending, Not approved. We add
 * "conflict" (Google is serving its own value for the field, resolved via
 * Google Updates) and "unknown" (status could not be determined).
 */
export type GbpEditStatus = "accepted" | "pending" | "not_approved" | "conflict" | "unknown";

export const GBP_EDIT_STATUS_LABELS: Record<GbpEditStatus, string> = {
  accepted: "Accepted",
  pending: "Pending",
  not_approved: "Not approved",
  conflict: "Google conflict",
  unknown: "Unknown",
};

export interface GbpEditStatusResult {
  status: GbpEditStatus;
  label: string;
  /** User-facing explanation with next steps. */
  detail: string;
  /** The text currently live on the profile field. */
  liveText: string;
  checkedAt: string;
}

export interface DescriptionEditStatusInput {
  /** The text that was published (post-sanitization). */
  sentText: string;
  /** The text Google currently serves for profile.description. */
  liveText: string;
  pendingMask?: string;
  diffMask?: string;
}

/** Pure mapping from live Google state to an edit review status. */
export function resolveDescriptionEditStatus(
  input: DescriptionEditStatusInput
): Pick<GbpEditStatusResult, "status" | "label" | "detail"> {
  const { sentText, liveText, pendingMask, diffMask } = input;

  if (!sentText.trim()) {
    return {
      status: "unknown",
      label: GBP_EDIT_STATUS_LABELS.unknown,
      detail: "No published description text to compare against Google.",
    };
  }

  if (descriptionsMatch(sentText, liveText)) {
    return {
      status: "accepted",
      label: GBP_EDIT_STATUS_LABELS.accepted,
      detail: "Google accepted your edit — the updated description is live on your Business Profile.",
    };
  }

  if (maskIncludesField(pendingMask ?? "", GBP_DESCRIPTION_FIELD)) {
    return {
      status: "pending",
      label: GBP_EDIT_STATUS_LABELS.pending,
      detail:
        "Your edit is still under review by Google. This usually takes about 10 minutes, but can take up to 30 days. Check again later.",
    };
  }

  if (maskIncludesField(diffMask ?? "", GBP_DESCRIPTION_FIELD)) {
    return {
      status: "conflict",
      label: GBP_EDIT_STATUS_LABELS.conflict,
      detail:
        "Google is serving a different description than the one you published. Accept or reject Google's version in Take Action → Google Updates, then re-publish.",
    };
  }

  return {
    status: "not_approved",
    label: GBP_EDIT_STATUS_LABELS.not_approved,
    detail:
      "Google finished reviewing but your edit is not live, which usually means it was not approved. Rewrite the description (plain text, no contact info or promotional claims) and re-publish, or appeal the rejected edit in Business Profile Manager.",
  };
}

/**
 * Query Google for the current review status of a published description.
 * `publishedText` should be the draft that was published; it is re-sanitized
 * here so the comparison matches what was actually sent to Google.
 */
export async function checkGbpDescriptionEditStatus(
  connection: GbpConnection,
  publishedText: string
): Promise<GbpEditStatusResult> {
  const sentText = sanitizeGbpDescriptionForPublish(publishedText).text;

  const [profile, snapshot] = await Promise.all([
    getGbpLocationProfile(connection),
    getGoogleUpdatedSnapshot(connection).catch(() => ({
      location: {},
      diffMask: "",
      pendingMask: "",
    })),
  ]);

  const resolved = resolveDescriptionEditStatus({
    sentText,
    liveText: profile.description,
    pendingMask: snapshot.pendingMask,
    diffMask: snapshot.diffMask,
  });

  return {
    ...resolved,
    liveText: profile.description,
    checkedAt: new Date().toISOString(),
  };
}

/** Task result message for a status check, recognized by the republish logic. */
export function editStatusResultMessage(result: GbpEditStatusResult): string {
  switch (result.status) {
    case "accepted":
      return `Description verified on Google Business Profile. Edit status: Accepted — ${result.detail}`;
    case "pending":
      return `Description submitted — Google is processing or reviewing it. Edit status: Pending — ${result.detail}`;
    case "conflict":
      return `Edit status: Google conflict — ${result.detail}`;
    case "not_approved":
      return `Edit status: Not approved — ${result.detail}`;
    default:
      return `Edit status: Unknown — ${result.detail}`;
  }
}

/** Whether a status check outcome should mark the task failed (needs action). */
export function editStatusIsFailure(status: GbpEditStatus): boolean {
  return status === "not_approved" || status === "conflict";
}

export interface StoredEditStatus {
  status: GbpEditStatus;
  label: string;
  detail: string;
  checkedAt: string;
}

/** Read the last stored edit status from a task payload, if any. */
export function editStatusFromPayload(
  payload: Record<string, unknown> | undefined
): StoredEditStatus | null {
  const raw = payload?.editStatus;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.status !== "string" || typeof record.checkedAt !== "string") return null;
  return {
    status: record.status as GbpEditStatus,
    label:
      typeof record.label === "string"
        ? record.label
        : GBP_EDIT_STATUS_LABELS[record.status as GbpEditStatus] ?? "Unknown",
    detail: typeof record.detail === "string" ? record.detail : "",
    checkedAt: record.checkedAt,
  };
}
