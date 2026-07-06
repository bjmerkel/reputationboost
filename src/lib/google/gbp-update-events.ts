import { createAdminClient } from "@/lib/supabase/admin";
import { findBusinessRecordByGbpLocation } from "@/lib/review-requests/attribution";

export async function recordGbpGoogleUpdateEvent(
  locationName: string,
  options?: { detectedAt?: string; eventId?: string }
): Promise<{ businessId: string; userId: string } | null> {
  const businessRecord = await findBusinessRecordByGbpLocation(locationName);
  if (!businessRecord) return null;

  const supabase = createAdminClient();
  const detectedAt = options?.detectedAt ?? new Date().toISOString();

  const { error } = await supabase
    .from("businesses")
    .update({ gbp_google_update_at: detectedAt })
    .eq("id", businessRecord.id);

  if (error) throw new Error(error.message);

  console.info("[gbp-google-update]", {
    businessId: businessRecord.id,
    locationName,
    eventId: options?.eventId ?? null,
    detectedAt,
  });

  return { businessId: businessRecord.id, userId: businessRecord.user_id };
}
