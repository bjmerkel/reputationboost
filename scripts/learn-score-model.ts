#!/usr/bin/env npx tsx
/**
 * Learn global score model from stored timeseries and persist to score_model_global.
 *
 * Usage:
 *   npm run learn:score-model
 *   npx tsx scripts/learn-score-model.ts --days=120
 */
import { refreshGlobalScoreModel } from "../src/audit/storage-score-model";

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const days = Number(parseArg("days") ?? "120");
  const model = await refreshGlobalScoreModel(days);

  console.log("Learned score model");
  console.log(`  source:              ${model.source}`);
  console.log(`  click-share samples: ${model.clickShareSamples}`);
  console.log(
    `  click share curve:   #1=${model.clickShare.pack1}% #2=${model.clickShare.pack2}% #3=${model.clickShare.pack3}% outside=${model.clickShare.outsidePack}%`
  );
  console.log(`  blend samples:       ${model.blendSamples}`);
  console.log(
    `  blend weights:       visibility=${model.blendWeights.visibility.toFixed(2)} conversion=${model.blendWeights.conversion.toFixed(2)} revenue=${model.blendWeights.revenueCapture.toFixed(2)}`
  );
  console.log(`  updated:             ${model.updatedAt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
