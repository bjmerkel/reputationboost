#!/usr/bin/env npx tsx
/**
 * Compare Nearby Search vs Text Search ranks for a business sample.
 *
 * Usage:
 *   npx tsx scripts/validate-ranks.ts --business-id=<uuid>
 *   npx tsx scripts/validate-ranks.ts --business-id=<uuid> --keywords=kw1,kw2
 */
import { businessRecordToClientConfig } from "../src/audit/businesses";
import { validateKeywordRanks } from "../src/audit/phase2/rank-validation";
import { createAdminClient } from "../src/lib/supabase/admin";
import { isGoogleMapsConfigured } from "../src/lib/google/config";
import {
  resolveBusinessLocation,
} from "../src/lib/google/local-rankings";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  if (!isGoogleMapsConfigured()) {
    console.error("GOOGLE_MAPS_API_KEY is not configured.");
    process.exit(1);
  }

  const businessId = parseArg("business-id");
  if (!businessId) {
    console.error("Usage: npx tsx scripts/validate-ranks.ts --business-id=<uuid>");
    process.exit(1);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) {
    console.error(`Business not found: ${businessId}`);
    process.exit(1);
  }

  const client = businessRecordToClientConfig(data);
  const keywordsArg = parseArg("keywords");
  const keywords = keywordsArg
    ? keywordsArg.split(",").map((k) => k.trim()).filter(Boolean)
    : client.keywords;

  if (keywords.length === 0) {
    console.error("No keywords to validate.");
    process.exit(1);
  }

  const location = await resolveBusinessLocation(client);
  const matchOptions = {
    businessName: client.name,
    placeId: client.gbpPlaceId,
    businessAddress: [
      client.location.address,
      client.location.city,
      client.location.state,
      client.location.zip,
    ]
      .filter(Boolean)
      .join(", "),
  };
  const locationLabel = `${client.location.city}, ${client.location.state}`;

  console.log(`Validating ${keywords.length} keyword(s) for ${client.name}...`);
  const { results, summary } = await validateKeywordRanks(
    keywords,
    location,
    matchOptions,
    { locationLabel }
  );

  for (const row of results) {
    const nearby = row.nearbyRank ?? "—";
    const text = row.textRank ?? "—";
    const flag = row.packDisagreement ? "PACK MISMATCH" : row.rankDisagreement ? "rank diff" : "ok";
    console.log(
      `  ${row.keyword}: nearby=${nearby} text=${text} delta=${row.rankDelta ?? "—"} [${flag}]`
    );
  }

  console.log("\nSummary:");
  console.log(`  keywords:              ${summary.keywordCount}`);
  console.log(
    `  pack disagreement:     ${summary.packDisagreementCount} (${(summary.packDisagreementRate * 100).toFixed(1)}%)`
  );
  console.log(
    `  rank disagreement:     ${summary.rankDisagreementCount} (${(summary.rankDisagreementRate * 100).toFixed(1)}%)`
  );
  console.log(`  mean |rank delta|:     ${summary.meanAbsRankDelta ?? "—"}`);
  console.log(`  max |rank delta|:      ${summary.maxAbsRankDelta ?? "—"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
