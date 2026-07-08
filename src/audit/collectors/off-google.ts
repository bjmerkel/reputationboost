import type { ClientConfig, OffGoogleSnapshot } from "../types";

/**
 * Collects basic website/local SEO signals (schema, NAP) and social activity.
 */
export async function collectOffGoogleSnapshot(
  client: ClientConfig
): Promise<OffGoogleSnapshot> {
  return collectOffGoogleDemo(client);
}

function collectOffGoogleDemo(client: ClientConfig): OffGoogleSnapshot {
  const now = new Date().toISOString();

  return {
    collectedAt: now,
    website: {
      napMatch: true,
      hasLocalBusinessSchema: false,
      hasLocalLandingPage: Boolean(client.website),
      issues: ["Missing LocalBusiness schema markup"],
    },
    socialPostCountLast30Days: 2,
  };
}
