import type { Phase1AuditPayload } from "@/audit/types";

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Anonymized market segment key for cross-client calibration (Phase D). */
export function deriveMarketKey(audit: Phase1AuditPayload): string {
  const category = slug(
    audit.gbp.liveProfile?.primaryCategory ??
      audit.gbp.identity.primaryCategory ??
      "local_business"
  );
  const address = audit.gbp.identity.address ?? "";
  const cityMatch = address.match(/,\s*([^,]+),\s*([A-Z]{2})\b/i);
  const city = cityMatch?.[1] ? slug(cityMatch[1]) : "unknown_city";
  const state = cityMatch?.[2]?.toUpperCase() ?? "unknown_state";
  return `${category}|${state}|${city}`;
}

/** Fallback keys from specific metro → state vertical → category. */
export function deriveVerticalMarketKeys(marketKey: string): string[] {
  const parts = marketKey.split("|").filter(Boolean);
  if (parts.length >= 3) {
    return [marketKey, `${parts[0]}|${parts[1]}`, parts[0]!];
  }
  if (parts.length === 2) {
    return [marketKey, parts[0]!];
  }
  return [marketKey];
}
