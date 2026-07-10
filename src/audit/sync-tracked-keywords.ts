import { applyTrackedKeywordsToAudit } from "@/audit/phase2/keyword-portfolio";
import type { Phase1AuditPayload } from "@/audit/types";

function keywordSignature(keywords: string[]): string {
  return keywords
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

/** True when audit rankings already match the tracked business keyword list. */
export function auditMatchesTrackedKeywords(
  audit: Phase1AuditPayload,
  keywords: string[]
): boolean {
  const tracked = keywordSignature(keywords);
  if (!tracked) return true;
  const ranked = keywordSignature(audit.rankings.keywords.map((item) => item.keyword));
  return tracked === ranked;
}

/**
 * Align audit rankings + portfolio with the business tracked keyword list.
 * Returns the same audit reference when already in sync.
 */
export function syncAuditToTrackedKeywords<T extends Phase1AuditPayload>(
  audit: T,
  keywords: string[]
): T {
  if (auditMatchesTrackedKeywords(audit, keywords)) return audit;
  return applyTrackedKeywordsToAudit(audit, keywords) as T;
}
