import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gbpIdentityMigrationHint,
  isGbpIdentityColumnSchemaError,
  withoutGbpIdentityColumns,
} from "@/audit/gbp-identity-schema";

type BusinessUpdateClient = Pick<SupabaseClient, "from">;

export async function updateBusinessRow(
  supabase: BusinessUpdateClient,
  userId: string,
  businessId: string,
  patch: Record<string, unknown>,
  actionLabel: string
): Promise<void> {
  const apply = (payload: Record<string, unknown>) =>
    supabase
      .from("businesses")
      .update(payload)
      .eq("user_id", userId)
      .eq("id", businessId);

  let { error } = await apply(patch);
  if (error && isGbpIdentityColumnSchemaError(error.message)) {
    const legacyPatch = withoutGbpIdentityColumns(patch);
    const droppedIdentityOnly =
      Object.keys(legacyPatch).length === 1 && "updated_at" in legacyPatch;

    if (droppedIdentityOnly) {
      throw new Error(
        `Failed to ${actionLabel}: ${error.message}. ${gbpIdentityMigrationHint()}`
      );
    }

    console.warn(
      `[businesses] GBP identity columns missing while trying to ${actionLabel}; ` +
        `retrying without identity fields. ${gbpIdentityMigrationHint()}`
    );
    ({ error } = await apply(legacyPatch));
  }

  if (error) {
    throw new Error(`Failed to ${actionLabel}: ${error.message}`);
  }
}
