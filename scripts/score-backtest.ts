#!/usr/bin/env npx tsx
/**
 * Backtest listing strength scores against stored rank outcomes.
 *
 * Usage:
 *   npx tsx scripts/score-backtest.ts
 *   npx tsx scripts/score-backtest.ts --days=120 --horizon=28
 *   npx tsx scripts/score-backtest.ts --business-id=<uuid>
 */
import {
  buildBacktestSamples,
  evaluateBacktestMetrics,
  DEFAULT_BACKTEST_HORIZON_DAYS,
} from "../src/audit/phase2/score-backtest";
import {
  listAllRankSnapshotsAdmin,
  listAllScoreDailyAdmin,
  listScoreDailyForBusinessAdmin,
  listRankSnapshotsForBusinessRange,
} from "../src/audit/storage-score-daily";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function addDaysYmd(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function main() {
  const days = Number(parseArg("days") ?? "90");
  const horizon = Number(parseArg("horizon") ?? String(DEFAULT_BACKTEST_HORIZON_DAYS));
  const businessId = parseArg("business-id");

  let scores;
  let ranks;

  if (businessId) {
    scores = await listScoreDailyForBusinessAdmin(businessId, days + horizon);
    const end = new Date().toISOString().slice(0, 10);
    const start = addDaysYmd(end, -(days + horizon));
    ranks = await listRankSnapshotsForBusinessRange(businessId, start, end);
  } else {
    scores = await listAllScoreDailyAdmin(days + horizon);
    ranks = await listAllRankSnapshotsAdmin(days + horizon);
  }

  const samples = buildBacktestSamples(scores, ranks, horizon);
  const metrics = evaluateBacktestMetrics(samples, horizon);

  console.log("Score backtest");
  console.log(`  scope:         ${businessId ?? "all businesses"}`);
  console.log(`  lookback:      ${days} days (+${horizon}d horizon)`);
  console.log(`  samples:       ${metrics.sampleCount}`);
  console.log("");
  console.log("Predictiveness (score at T vs rank delta at T+horizon):");
  console.log(`  conversion ρ:  ${metrics.conversionRankDeltaCorrelation ?? "n/a"}`);
  console.log(`  visibility ρ:  ${metrics.visibilityRankDeltaCorrelation ?? "n/a"}`);
  console.log(`  overall ρ:     ${metrics.overallRankDeltaCorrelation ?? "n/a"}`);
  console.log("");
  console.log("Pack entry (outside-pack keywords only):");
  console.log(
    `  high conversion entry rate: ${metrics.conversionPackEntryRate != null ? (metrics.conversionPackEntryRate * 100).toFixed(1) + "%" : "n/a"}`
  );
  console.log(
    `  low conversion entry rate:  ${metrics.lowConversionPackEntryRate != null ? (metrics.lowConversionPackEntryRate * 100).toFixed(1) + "%" : "n/a"}`
  );
  console.log(`  lift (high - low):        ${metrics.packEntryLift ?? "n/a"}`);

  if (metrics.sampleCount < 10) {
    console.log("\nNote: fewer than 10 samples — metrics are not statistically meaningful yet.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
