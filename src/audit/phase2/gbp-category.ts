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
