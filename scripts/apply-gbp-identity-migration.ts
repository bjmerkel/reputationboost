#!/usr/bin/env npx tsx
/**
 * Apply GBP identity columns to the production Supabase database.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/apply-gbp-identity-migration.ts
 *
 * Or paste supabase/migrations/028_gbp_identity.sql into the Supabase SQL Editor.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/028_gbp_identity.sql"
);
const sql = readFileSync(migrationPath, "utf8");
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.log("DATABASE_URL is not set. Run this SQL in the Supabase SQL Editor:\n");
  console.log(sql);
  process.exit(0);
}

const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", migrationPath], {
  stdio: "inherit",
});

if (result.error) {
  console.error(
    "Failed to run psql. Install PostgreSQL client tools or paste the SQL manually in Supabase."
  );
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
