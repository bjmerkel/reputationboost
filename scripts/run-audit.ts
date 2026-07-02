#!/usr/bin/env npx tsx
/**
 * Run Phase 1 audit from CLI (for cron / local automation).
 * Usage: npm run audit:run [-- --client=san-diego-stucco --trigger=monthly]
 */
import { listClients } from "../src/audit/clients";
import { runPhase1Audit } from "../src/audit/orchestrator";
import type { AuditTrigger } from "../src/audit/types";

function parseArgs() {
  const args = process.argv.slice(2);
  let clientId = listClients()[0]?.id;
  let trigger: AuditTrigger = "monthly";

  for (const arg of args) {
    if (arg.startsWith("--client=")) clientId = arg.split("=")[1];
    if (arg.startsWith("--trigger=")) trigger = arg.split("=")[1] as AuditTrigger;
  }

  return { clientId, trigger };
}

async function main() {
  const { clientId, trigger } = parseArgs();

  if (!clientId) {
    console.error("No client configured.");
    process.exit(1);
  }

  console.log(`Running Phase 1 audit for ${clientId} (${trigger})...`);

  const result = await runPhase1Audit(clientId, trigger);

  console.log("Audit complete.");
  console.log(`  Audit ID:   ${result.audit.auditId}`);
  console.log(`  Period:     ${result.audit.period}`);
  console.log(`  In 3-Pack:  ${result.audit.rankings.keywordsInPack}/${result.audit.rankings.totalKeywords} keywords`);
  console.log(`  GBP Score:  ${result.audit.gbp.completeness.completenessScore}%`);
  console.log(`  Saved to:   ${result.storagePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
