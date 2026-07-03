import type { FullAuditPayload } from "@/audit/types";

/** Prefer the industry from settings over stale Places/audit category labels. */
export function resolveDisplayCategory(
  audit: FullAuditPayload,
  industry?: string | null
): string | undefined {
  const fromSettings = industry?.trim();
  if (fromSettings) return fromSettings;

  return (
    audit.gbp.liveProfile?.primaryCategory ||
    audit.gbp.identity.primaryCategory ||
    undefined
  );
}
