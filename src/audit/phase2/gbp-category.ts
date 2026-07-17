import type { Phase1AuditPayload } from "../types";

/** Normalize GBP category labels for equality checks (spacing/case). */
export function normalizeCategoryLabel(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function categoryLabelsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizeCategoryLabel(a);
  const right = normalizeCategoryLabel(b);
  return Boolean(left) && left === right;
}

export function resolveLivePrimaryCategory(audit: Phase1AuditPayload): string {
  return (
    audit.gbp.liveProfile?.primaryCategory?.trim() ||
    audit.gbp.identity.primaryCategory?.trim() ||
    ""
  );
}

/** Recommended primary category for plan step 1 (currently the audit identity category). */
export function resolveRecommendedPrimaryCategory(audit: Phase1AuditPayload): string {
  return audit.gbp.identity.primaryCategory?.trim() || resolveLivePrimaryCategory(audit);
}

/** True when live primary already matches the recommended category (no-op update). */
export function primaryCategoryUpdateIsNoOp(audit: Phase1AuditPayload): boolean {
  const live = resolveLivePrimaryCategory(audit);
  const recommended = resolveRecommendedPrimaryCategory(audit);
  return categoryLabelsMatch(live, recommended);
}

/** Placeholder labels like "HVAC contractor (keep as primary)" are not addable secondaries. */
export function isKeepAsPrimaryCategoryLabel(value: string): boolean {
  return /\bkeep as primary\b/i.test(value) || /\(primary\)/i.test(value);
}

/**
 * Drop primary-category labels and "keep as primary" placeholders from secondary
 * recommendations — a category cannot be both primary and secondary.
 */
export function filterActionableSecondaryCategories(
  audit: Phase1AuditPayload,
  categories: string[]
): string[] {
  const primaryLabels = [
    resolveLivePrimaryCategory(audit),
    audit.gbp.identity.primaryCategory,
  ]
    .map((label) => normalizeCategoryLabel(label))
    .filter(Boolean);

  const primarySet = new Set(primaryLabels);
  const seen = new Set<string>();
  const actionable: string[] = [];

  for (const raw of categories) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || isKeepAsPrimaryCategoryLabel(trimmed)) continue;

    const normalized = normalizeCategoryLabel(trimmed);
    if (!normalized || primarySet.has(normalized) || seen.has(normalized)) continue;

    seen.add(normalized);
    actionable.push(trimmed);
  }

  return actionable;
}
