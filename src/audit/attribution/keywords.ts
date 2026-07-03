import type { ExecutionTask } from "@/audit/types";

/** Match business keywords mentioned in text (case-insensitive). */
export function matchKeywordsInText(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

/** Resolve which keywords an execution task likely affects. */
export function resolveTargetKeywords(task: ExecutionTask, keywords: string[]): string[] {
  const fromPayload = task.payload.targetKeywords;
  if (Array.isArray(fromPayload)) {
    const resolved = fromPayload.filter((k): k is string => typeof k === "string" && k.length > 0);
    if (resolved.length > 0) return resolved;
  }

  const fromDraft = matchKeywordsInText(task.draftContent, keywords);
  if (fromDraft.length > 0) return fromDraft;

  const reviewText = String(task.payload.reviewText ?? "");
  const fromReview = matchKeywordsInText(reviewText, keywords);
  if (fromReview.length > 0) return fromReview;

  const hint = String(task.payload.hint ?? task.payload.keyword ?? "");
  const fromHint = matchKeywordsInText(hint, keywords);
  if (fromHint.length > 0) return fromHint;

  switch (task.type) {
    case "gbp_description":
    case "gbp_services":
    case "gbp_primary_category":
    case "gbp_secondary_categories":
      return keywords;
    default:
      return keywords.length > 0 ? [keywords[0]] : [];
  }
}

/** Pick the primary keyword for attribution (best rank improvement or first match). */
export function pickPrimaryKeyword(
  targetKeywords: string[],
  rankByKeyword: Map<string, { before: number | null; after: number | null }>
): string | null {
  if (targetKeywords.length === 0) return null;
  if (targetKeywords.length === 1) return targetKeywords[0];

  let best: { keyword: string; delta: number } | null = null;

  for (const keyword of targetKeywords) {
    const ranks = rankByKeyword.get(keyword);
    if (!ranks) continue;
    const before = ranks.before ?? 99;
    const after = ranks.after ?? 99;
    const delta = before - after;
    if (!best || delta > best.delta) {
      best = { keyword, delta };
    }
  }

  return best?.keyword ?? targetKeywords[0];
}
