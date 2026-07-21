import type { ClientConfig, FullAuditPayload } from "@/audit/types";
import { buildAiVisibilitySnapshot } from "@/audit/collectors/ai-visibility/scoring";
import { probeDemo } from "@/audit/collectors/ai-visibility/providers/demo";
import { buildAiQueryVariants } from "@/audit/collectors/ai-visibility/query-variants";
import { AI_VISIBILITY_FLAGS } from "@/lib/feature-flags";
import demoAuditPayload from "./demo-audit-payload.json";

function buildDemoAiVisibility(audit: FullAuditPayload) {
  const client: ClientConfig = {
    id: "demo",
    name: audit.clientName,
    industry: audit.gbp.identity.primaryCategory || "local business",
    location: {
      address: audit.gbp.identity.address,
      city: "Dallas",
      state: "TX",
      zip: "75201",
      lat: 32.7767,
      lng: -96.797,
    },
    keywords: audit.rankings.keywords.map((keyword) => keyword.keyword),
  };

  const probes = client.keywords.flatMap((keyword) => {
    const queries = buildAiQueryVariants(keyword, client.location.city, client.location.state);
    return AI_VISIBILITY_FLAGS.surfaces.flatMap((surface) =>
      queries.map((queryText) => probeDemo(client, surface, keyword, queryText))
    );
  });

  return buildAiVisibilitySnapshot(probes, client.keywords, "demo");
}

/** Static demo audit for the marketing platform explorer when no business is selected. */
export function createMarketingDemoAudit(): FullAuditPayload {
  const audit = demoAuditPayload as FullAuditPayload;
  return {
    ...audit,
    aiVisibility: buildDemoAiVisibility(audit),
  };
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
