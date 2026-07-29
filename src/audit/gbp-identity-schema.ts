/** Columns added in supabase/migrations/028_gbp_identity.sql */
export const GBP_IDENTITY_COLUMN_KEYS = [
  "gbp_address",
  "gbp_open_status",
  "gbp_secondary_categories",
  "gbp_service_area",
] as const;

export type GbpIdentityColumnKey = (typeof GBP_IDENTITY_COLUMN_KEYS)[number];

export const GBP_IDENTITY_MIGRATION_PATH = "supabase/migrations/028_gbp_identity.sql";

export function isGbpIdentityColumnSchemaError(message: string | undefined): boolean {
  if (!message) return false;
  return GBP_IDENTITY_COLUMN_KEYS.some((column) =>
    message.includes(`'${column}' column`)
  );
}

export function withoutGbpIdentityColumns<T extends Record<string, unknown>>(
  patch: T
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...patch };
  for (const key of GBP_IDENTITY_COLUMN_KEYS) {
    delete next[key];
  }
  return next;
}

export function gbpIdentityMigrationHint(): string {
  return `Apply ${GBP_IDENTITY_MIGRATION_PATH} in the Supabase SQL Editor.`;
}
