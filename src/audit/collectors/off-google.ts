import type { ClientConfig, CitationCheck, OffGoogleSnapshot } from "../types";

/**
 * Collects citation consistency and basic website/local SEO signals.
 */
export async function collectOffGoogleSnapshot(
  client: ClientConfig
): Promise<OffGoogleSnapshot> {
  if (process.env.CITATION_SCANNER_API_KEY) {
    return collectOffGoogleFromApi(client);
  }
  return collectOffGoogleDemo(client);
}

async function collectOffGoogleFromApi(
  client: ClientConfig
): Promise<OffGoogleSnapshot> {
  void client;
  throw new Error(
    "Live citation scanner pending. Set CITATION_SCANNER_API_KEY and implement collectOffGoogleFromApi."
  );
}

function collectOffGoogleDemo(client: ClientConfig): OffGoogleSnapshot {
  const now = new Date().toISOString();

  const citations: CitationCheck[] = [
    { source: "Google Business Profile", nameMatch: true, addressMatch: true, phoneMatch: true },
    { source: "Yelp", nameMatch: true, addressMatch: true, phoneMatch: true },
    { source: "Apple Maps", nameMatch: true, addressMatch: false, phoneMatch: true },
    { source: "Bing Places", nameMatch: true, addressMatch: true, phoneMatch: true },
    { source: "Facebook", nameMatch: true, addressMatch: true, phoneMatch: false },
  ];

  const matchCount = citations.filter(
    (c) => c.nameMatch && c.addressMatch && c.phoneMatch
  ).length;

  return {
    collectedAt: now,
    citations,
    citationConsistencyScore: Math.round((matchCount / citations.length) * 100),
    website: {
      napMatch: true,
      hasLocalBusinessSchema: false,
      hasLocalLandingPage: Boolean(client.website),
      issues: [
        "Missing LocalBusiness schema markup",
        "Apple Maps address abbreviation differs from GBP",
      ],
    },
    socialPostCountLast30Days: 2,
  };
}
