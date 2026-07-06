import { maskIncludesField } from "./gbp-google-updated";

/** Google Business Profile description field limit (characters). */
export const GBP_DESCRIPTION_MAX_LENGTH = 750;

/** Field mask path for the description on Google's Location resource. */
export const GBP_DESCRIPTION_FIELD = "profile.description";

const SIMULATED_RESULT = "Updated GBP business description.";

/** Matches http(s) URLs and bare www. domains Google rejects in descriptions. */
const URL_PATTERN =
  /\bhttps?:\/\/[^\s<>"']+|\bwww\.[a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)+[^\s<>"',.]*/gi;

/** HTML tags Google rejects in plain-text descriptions. */
const HTML_TAG_PATTERN = /<[^>]+>/g;

/** Control chars and odd Unicode format chars that often trigger INVALID_CHARACTERS. */
const INVALID_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g;

/** Collapse runs of punctuation Google often flags (e.g. "!!!", "???"). */
const EXCESS_PUNCTUATION_PATTERN = /([!?.]){2,}/g;

/** Promotional phrasing Google may silently block or hold in moderation. */
const PROMOTIONAL_PHRASE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b\d+\s*%\s*off\b/i, label: "percentage discounts" },
  { pattern: /\b(cheapest|lowest price|best price|lowest rates)\b/i, label: "superlative pricing claims" },
  { pattern: /\b(sale|clearance|limited time offer|act now|hurry)\b/i, label: "sales urgency language" },
  { pattern: /\b(free estimate|free quote)\b/i, label: "free-offer phrasing" },
  { pattern: /\b(#1|number one|top rated)\b/i, label: "unverifiable ranking claims" },
];

export interface GbpDescriptionSanitizeResult {
  text: string;
  removedUrls: boolean;
  removedHtml: boolean;
  removedInvalidChars: boolean;
  normalizedPunctuation: boolean;
  contentPolicyWarnings: string[];
}

export function normalizeGbpDescription(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function detectDescriptionContentPolicyWarnings(text: string): string[] {
  const warnings: string[] = [];
  for (const { pattern, label } of PROMOTIONAL_PHRASE_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(label);
    }
    pattern.lastIndex = 0;
  }
  return warnings;
}

/** Prepare description text for Google's profile.description field. */
export function sanitizeGbpDescriptionForPublish(text: string): GbpDescriptionSanitizeResult {
  const working = text.replace(/\r\n/g, "\n").trim();
  const hadUrls = URL_PATTERN.test(working);
  URL_PATTERN.lastIndex = 0;
  const hadHtml = HTML_TAG_PATTERN.test(working);
  HTML_TAG_PATTERN.lastIndex = 0;

  const withoutHtml = working.replace(HTML_TAG_PATTERN, " ");
  const withoutUrls = withoutHtml.replace(URL_PATTERN, "");
  const withoutInvalid = withoutUrls.replace(INVALID_CHAR_PATTERN, "");
  const removedInvalidChars = withoutInvalid !== withoutUrls;

  const punctBefore = withoutInvalid;
  const withoutExcessPunctuation = withoutInvalid.replace(EXCESS_PUNCTUATION_PATTERN, "$1");
  const normalizedPunctuation = withoutExcessPunctuation !== punctBefore;

  const normalized = normalizeGbpDescription(withoutExcessPunctuation);
  const truncated =
    normalized.length > GBP_DESCRIPTION_MAX_LENGTH
      ? normalized.slice(0, GBP_DESCRIPTION_MAX_LENGTH).trim()
      : normalized;

  return {
    text: truncated,
    removedUrls: hadUrls,
    removedHtml: hadHtml,
    removedInvalidChars,
    normalizedPunctuation,
    contentPolicyWarnings: detectDescriptionContentPolicyWarnings(truncated),
  };
}

export function buildDescriptionSanitizeNote(result: GbpDescriptionSanitizeResult): string | null {
  const notes: string[] = [];
  if (result.removedUrls) {
    notes.push("URLs were removed because Google does not allow links in descriptions");
  }
  if (result.removedHtml) {
    notes.push("HTML tags were removed — use plain text only");
  }
  if (result.removedInvalidChars) {
    notes.push("unsupported characters were removed");
  }
  if (result.normalizedPunctuation) {
    notes.push("repeated punctuation was simplified");
  }
  if (result.contentPolicyWarnings.length > 0) {
    notes.push(
      `Google may delay or reject descriptions with ${result.contentPolicyWarnings.join(", ")} — consider rephrasing`
    );
  }
  if (notes.length === 0) return null;
  return `${notes.join("; ")}.`;
}

export interface DescriptionPublishPreflight {
  /** profile.description is in Google's diffMask — accept/reject required first. */
  hasConflict: boolean;
  /** profile.description is in Google's pendingMask — already processing. */
  isProcessing: boolean;
  /** Safe to PATCH profile.description with a new value. */
  canPatch: boolean;
  blockReason: string | null;
}

export function preflightDescriptionPublish(snapshot: {
  diffMask?: string;
  pendingMask?: string;
}): DescriptionPublishPreflight {
  const hasConflict = maskIncludesField(snapshot.diffMask ?? "", GBP_DESCRIPTION_FIELD);
  const isProcessing = maskIncludesField(snapshot.pendingMask ?? "", GBP_DESCRIPTION_FIELD);

  if (hasConflict) {
    return {
      hasConflict: true,
      isProcessing,
      canPatch: false,
      blockReason:
        "Google has a conflicting description for profile.description. Resolve it in Take Action → Google Updates before publishing.",
    };
  }

  if (isProcessing) {
    return {
      hasConflict: false,
      isProcessing: true,
      canPatch: false,
      blockReason:
        "Google is already processing a description change (profile.description). Wait a few hours before publishing again.",
    };
  }

  return {
    hasConflict: false,
    isProcessing: false,
    canPatch: true,
    blockReason: null,
  };
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
    result.includes("Description submitted — Google is processing") ||
    result.includes("Description submitted — Google is processing or reviewing")
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
        "Description submitted — Google is processing or reviewing it. Content policy checks can take a few hours before it appears on Maps and Search.",
    };
  }

  if (hasDiff) {
    return {
      success: false,
      message:
        "Google is showing a different description than what you submitted. Use Take Action → Google Updates to accept or reject Google's version before your description can go live.",
    };
  }

  if (hasPendingEdits) {
    return {
      success: false,
      message:
        "Description sent to Google but is not live yet. Google has pending edits or moderation holds on your profile — resolve them in Business Profile Manager or Take Action → Google Updates.",
    };
  }

  if (!liveDescription.trim()) {
    return {
      success: false,
      message:
        "Google accepted the update but the description is not showing yet. It may be in Google's moderation queue, or your profile may have a verification hold — check Business Profile Manager.",
    };
  }

  return {
    success: false,
    message: `Description may not have saved correctly. Google shows ${liveDescription.length} characters; we sent ${sentLength}. Try publishing again from the plan.`,
  };
}
