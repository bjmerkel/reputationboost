import { createTestAudit } from "@/audit/phase3/test-fixtures";
import type { FullAuditPayload } from "@/audit/types";

/** Static demo audit for the marketing platform explorer when no business is selected. */
export function createMarketingDemoAudit(): FullAuditPayload {
  return createTestAudit();
}

export const DEMO_BUSINESS = {
  name: "Dallas Pro Plumbing",
  industry: "Plumber",
  location: {
    lat: 32.7767,
    lng: -96.797,
    address: "123 Main St, Dallas, TX 75201",
  },
} as const;
