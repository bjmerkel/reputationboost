import type { FullAuditPayload } from "@/audit/types";
import demoAuditPayload from "./demo-audit-payload.json";

/** Static demo audit for the marketing platform explorer when no business is selected. */
export function createMarketingDemoAudit(): FullAuditPayload {
  return demoAuditPayload as FullAuditPayload;
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
