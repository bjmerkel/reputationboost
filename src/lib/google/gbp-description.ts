/** Google Business Profile description field limit (characters). */
export const GBP_DESCRIPTION_MAX_LENGTH = 750;

const SIMULATED_RESULT = "Updated GBP business description.";

/** Matches http(s) URLs and bare www. domains Google rejects in descriptions. */
const URL_PATTERN =
  /\bhttps?:\/\/[^\s<>"']+|\bwww\.[a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+[^\s<>"',.]*/gi;

/** Control chars and odd Unicode format chars that often trigger INVALID_CHARACTERS. */
const INVALID_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g;

export interface GbpDescriptionSanitizeResult {
  text: string;
  removedUrls: boolean;
  removedInvalidChars: boolean;
}

export function normalizeGbpDescription(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** Prepare description text for Google's profile.description field. */
export function sanitizeGbpDescriptionForPublish(text: string): GbpDescriptionSanitizeResult {
  const working = text.replace(/\r\n/g, "\n").trim();
  const hadUrls = URL_PATTERN.test(working);
  URL_PATTERN.lastIndex = 0;
  const withoutUrls = working.replace(URL_PATTERN, "");
  const withoutInvalid = withoutUrls.replace(INVALID_CHAR_PATTERN, "");
  const removedInvalidChars = withoutInvalid !== withoutUrls;

  const normalized = normalizeGbpDescription(withoutInvalid);
  const truncated =
    normalized.length > GBP_DESCRIPTION_MAX_LENGTH
      ? normalized.slice(0, GBP_DESCRIPTION_MAX_LENGTH).trim()
      : normalized;

  return {
    text: truncated,
    removedUrls: hadUrls,
    removedInvalidChars,
  };
}

export function buildDescriptionSanitizeNote(result: GbpDescriptionSanitizeResult): string | null {
  const notes: string[] = [];
  if (result.removedUrls) {
    notes.push("URLs were removed because Google does not allow links in descriptions");
  }
  if (result.removedInvalidChars) {
    notes.push("unsupported characters were removed");
  }
  if (notes.length === 0) return null;
  return `${notes.join("; ")}.`;
}

/** Compare sent vs live description, allowing for Google's 750-char cap. */
export function descriptionsMatch(sent: string, live: string): boolean {
  const normalizedSent = normalizeGbpDescription(sent);
  const normalizedLive = normalizeGbpDescription(live);
  if (!normalizedSent) return false;
  if (normalizedSent === normalizedLive) return true;

  if (normalizedSent.length > GBP_DESCRIPTION_MAX_LENGTH) {
    const truncated = normalizeGbpDescription(normalizedSent.slice(0, GBP_DESCRIPTION_MAX_LENGTH));
    if (truncated === normalizedLive) return true;
  }

  return false;
}

export function wasGbpDescriptionSimulated(result?: string | null): boolean {
  return result?.trim() === SIMULATED_RESULT;
}

export function isGbpDescriptionLiveSync(result?: string | null): boolean {
  if (!result?.trim()) return false;
  if (wasGbpDescriptionSimulated(result)) return false;
  return (
    result.includes("Description verified on Google Business Profile") ||
    result.includes("Description submitted — Google is processing")
  );
}

export function needsGbpDescriptionRepublish(task: {
  type: string;
  status: string;
  result?: string | null;
}): boolean {
  if (task.type !== "gbp_description") return false;
  if (task.status === "failed") return true;
  return task.status === "completed" && !isGbpDescriptionLiveSync(task.result);
}

export interface DescriptionVerification {
  verified: boolean;
  hasPendingEdits: boolean;
  liveDescription: string;
  /** profile.description is in Google's pendingMask (still processing). */
  isProcessing?: boolean;
  /** profile.description is in Google's diffMask (conflict with serving data). */
  hasDiff?: boolean;
}

export function buildDescriptionApplyMessage(
  verification: DescriptionVerification,
  sentLength: number
): { success: boolean; message: string } {
  const { verified, hasPendingEdits, liveDescription, isProcessing, hasDiff } = verification;

  if (verified) {
    let message = "Description verified on Google Business Profile.";
    if (hasPendingEdits) {
      message +=
        " Google has other pending edits on your profile — resolve them in Business Profile Manager if the public listing still looks wrong.";
    }
    return { success: true, message };
  }

  if (isProcessing) {
    return {
      success: true,
      message:
        "Description submitted — Google is processing. It can take a few hours to appear on Maps and Search; no action needed.",
    };
  }

  if (hasDiff) {
    return {
      success: false,
      message:
        "Google is showing a different description than what you submitted. Accept or reject Google's version in Take Action to resolve the conflict.",
    };
  }

  if (hasPendingEdits) {
    return {
      success: false,
      message:
        "Description sent to Google but is not live yet. Google has pending edits on your profile — open Business Profile Manager and accept or reject suggested changes.",
    };
  }

  if (!liveDescription.trim()) {
    return {
      success: false,
      message:
        "Google accepted the update but the description is not showing on your profile yet. Check Business Profile Manager; it can take a few hours to appear on Maps and Search.",
    };
  }

  return {
    success: false,
    message: `Description may not have saved correctly. Google shows ${liveDescription.length} characters; we sent ${sentLength}. Try publishing again from the plan.`,
  };
}
