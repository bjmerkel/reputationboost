#!/usr/bin/env npx tsx
/**
 * Audits require a signed-in user with a connected GBP.
 * Use the platform at /platform/audit or POST /api/audit instead.
 */
console.error(
  "CLI audits are disabled. Sign in at /login, complete onboarding at /platform/onboard, then run audits from the dashboard."
);
process.exit(1);
