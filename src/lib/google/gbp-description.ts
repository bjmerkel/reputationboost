/** Google Business Profile description field limit (characters). */
export const GBP_DESCRIPTION_MAX_LENGTH = 750;

const SIMULATED_RESULT = "Updated GBP business description.";

export function normalizeGbpDescription(text: string): string {
  return text.trim().replace(/\s+/g, " ");
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
    result.includes("Business description updated on Google Business Profile") ||
    result.includes("Description verified on Google Business Profile")
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
}

export function buildDescriptionApplyMessage(
  verification: DescriptionVerification,
  sentLength: number
): { success: boolean; message: string } {
  const { verified, hasPendingEdits, liveDescription } = verification;

  if (verified) {
    let message = "Description verified on Google Business Profile.";
    if (hasPendingEdits) {
      message +=
        " Google has other pending edits on your profile — resolve them in Business Profile Manager if the public listing still looks wrong.";
    }
    return { success: true, message };
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
