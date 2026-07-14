import type { AuditTrigger } from "@/audit/types";

/**
 * User-initiated refreshes update fast-moving GBP data and reuse stored market
 * observations. Onboarding still needs an initial rank/competitor baseline.
 */
export function shouldReuseMarketData(
  trigger: AuditTrigger,
  hasBusinessId: boolean
): boolean {
  return trigger === "manual" && hasBusinessId;
}
