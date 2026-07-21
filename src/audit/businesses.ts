import type {
  ClientConfig,
  GbpConnection,
  GbpPersistedServiceArea,
} from "@/audit/types";
import { parseAutopilotMode, type AutopilotMode } from "@/audit/autopilot/modes";
import type { GridProfileKey } from "@/lib/google/geo-grid";
import { createClient } from "@/lib/supabase/server";

export interface BusinessRecord {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  industry: string;
  location: ClientConfig["location"];
  keywords: string[];
  gbp_place_id: string | null;
  gbp_maps_url: string | null;
  gbp_address: string | null;
  gbp_open_status: string | null;
  gbp_secondary_categories: string[];
  gbp_service_area: GbpPersistedServiceArea | null;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  gbp_refresh_token: string | null;
  gbp_access_token: string | null;
  gbp_token_expires_at: string | null;
  gbp_connected_at: string | null;
  gbp_google_email: string | null;
  onboarding_complete: boolean;
  avg_customer_value: number | null;
  avg_customer_value_currency: string;
  heatmap_profile: string;
  website: string | null;
  phone: string | null;
  private_feedback_url: string | null;
  webhook_token: string | null;
  webhook_auto_send: boolean;
  webhook_delay_hours: number;
  webhook_trigger_events: string[];
  gbp_google_update_at: string | null;
  last_manual_rank_refresh_at: string | null;
  autopilot_mode: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBusinessInput {
  name: string;
  industry: string;
  location: ClientConfig["location"];
  keywords: string[];
  website?: string;
  phone?: string;
  gbpPlaceId?: string;
  gbpMapsUrl?: string;
  avgCustomerValue?: number | null;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "business"}-${suffix}`;
}

export function businessRecordToClientConfig(row: BusinessRecord): ClientConfig {
  const connection: GbpConnection | undefined =
    row.gbp_account_id && row.gbp_location_id && row.gbp_refresh_token
      ? {
          businessId: row.id,
          accountId: row.gbp_account_id,
          locationId: row.gbp_location_id,
          placeId: row.gbp_place_id ?? undefined,
          googleEmail: row.gbp_google_email ?? undefined,
          accessToken: row.gbp_access_token ?? "",
          refreshToken: row.gbp_refresh_token,
          expiresAt: row.gbp_token_expires_at ?? new Date(0).toISOString(),
        }
      : undefined;

  return {
    id: row.slug,
    businessId: row.id,
    name: row.name,
    industry: row.industry,
    location: row.location,
    keywords: row.keywords ?? [],
    gbpPlaceId: row.gbp_place_id ?? undefined,
    gbpMapsUrl: row.gbp_maps_url ?? undefined,
    gbpAddress: row.gbp_address ?? undefined,
    gbpOpenStatus: row.gbp_open_status,
    gbpSecondaryCategories: row.gbp_secondary_categories ?? [],
    gbpServiceArea: row.gbp_service_area,
    website: row.website ?? undefined,
    phone: row.phone ?? undefined,
    gbpConnection: connection,
    onboardingComplete: row.onboarding_complete,
    avgCustomerValue: row.avg_customer_value != null ? Number(row.avg_customer_value) : null,
    avgCustomerValueCurrency: row.avg_customer_value_currency ?? "USD",
    heatmapProfile: (row.heatmap_profile as GridProfileKey) ?? "standard",
    privateFeedbackUrl: row.private_feedback_url ?? undefined,
    gbpGoogleUpdateAt: row.gbp_google_update_at ?? null,
    autopilotMode: parseAutopilotMode(row.autopilot_mode),
  };
}

export async function listUserBusinesses(userId: string): Promise<BusinessRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as BusinessRecord[];
}

export async function getPrimaryBusiness(userId: string): Promise<ClientConfig | null> {
  const rows = await listUserBusinesses(userId);
  const completed = rows
    .filter((r) => r.onboarding_complete && r.gbp_location_id)
    .sort(
      (a, b) =>
        new Date(b.gbp_connected_at ?? b.updated_at).getTime() -
        new Date(a.gbp_connected_at ?? a.updated_at).getTime()
    );

  const inProgress = rows
    .filter((r) => !r.onboarding_complete)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

  const row = inProgress[0] ?? completed[0] ?? rows[rows.length - 1];
  return row ? businessRecordToClientConfig(row) : null;
}

export async function loadBusinessConfig(
  userId: string,
  slug: string
): Promise<ClientConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Business not found: ${slug}`);
  return businessRecordToClientConfig(data as BusinessRecord);
}

export async function getBusinessRecord(
  userId: string,
  businessId: string
): Promise<BusinessRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .eq("id", businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BusinessRecord) ?? null;
}

export async function createBusiness(
  userId: string,
  input: CreateBusinessInput
): Promise<ClientConfig> {
  const supabase = await createClient();
  const slug = slugify(input.name);

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: userId,
      slug,
      name: input.name,
      industry: input.industry,
      location: input.location,
      keywords: input.keywords,
      gbp_place_id: input.gbpPlaceId ?? null,
      gbp_maps_url: input.gbpMapsUrl ?? null,
      website: input.website ?? null,
      phone: input.phone ?? null,
      onboarding_complete: false,
      avg_customer_value: input.avgCustomerValue ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create business: ${error.message}`);
  return businessRecordToClientConfig(data as BusinessRecord);
}

export async function saveGbpTokens(
  userId: string,
  businessId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: string; googleEmail?: string }
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    gbp_access_token: tokens.accessToken,
    gbp_refresh_token: tokens.refreshToken,
    gbp_token_expires_at: tokens.expiresAt,
    gbp_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (tokens.googleEmail) {
    patch.gbp_google_email = tokens.googleEmail.toLowerCase();
  }

  const { error } = await supabase
    .from("businesses")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", businessId);

  if (error) throw new Error(`Failed to save GBP tokens: ${error.message}`);
}

export interface GbpLocationSelection {
  accountId: string;
  locationId: string;
  placeId?: string;
  mapsUrl?: string;
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  industry?: string;
  openStatus?: string | null;
  secondaryCategories?: string[];
  serviceArea?: GbpPersistedServiceArea | null;
  businessLatLng?: { lat: number; lng: number } | null;
}

type ExistingGbpLocation = Pick<
  BusinessRecord,
  | "gbp_place_id"
  | "gbp_maps_url"
  | "gbp_address"
  | "gbp_open_status"
  | "gbp_secondary_categories"
  | "gbp_service_area"
  | "location"
>;

export function buildGbpLocationPatch(
  existing: ExistingGbpLocation | null,
  selection: GbpLocationSelection,
  updatedAt = new Date().toISOString()
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    gbp_account_id: selection.accountId,
    gbp_location_id: selection.locationId,
    gbp_place_id: selection.placeId ?? existing?.gbp_place_id ?? null,
    gbp_maps_url: selection.mapsUrl ?? existing?.gbp_maps_url ?? null,
    gbp_address: selection.address ?? existing?.gbp_address ?? null,
    gbp_open_status:
      selection.openStatus !== undefined
        ? selection.openStatus
        : existing?.gbp_open_status ?? null,
    gbp_secondary_categories:
      selection.secondaryCategories ?? existing?.gbp_secondary_categories ?? [],
    gbp_service_area:
      selection.serviceArea !== undefined
        ? selection.serviceArea
        : existing?.gbp_service_area ?? null,
    onboarding_complete: true,
    updated_at: updatedAt,
  };

  if (selection.name) patch.name = selection.name;
  if (selection.phone) patch.phone = selection.phone;
  if (selection.website) patch.website = selection.website;
  if (selection.industry) patch.industry = selection.industry;
  if (selection.businessLatLng && existing?.location) {
    patch.location = {
      ...existing.location,
      lat: selection.businessLatLng.lat,
      lng: selection.businessLatLng.lng,
    };
  }

  return patch;
}

export async function saveGbpLocation(
  userId: string,
  businessId: string,
  selection: GbpLocationSelection
): Promise<void> {
  const supabase = await createClient();
  const existing = await getBusinessRecord(userId, businessId);
  const patch = buildGbpLocationPatch(existing, selection);

  const { error } = await supabase
    .from("businesses")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", businessId);

  if (error) throw new Error(`Failed to save GBP location: ${error.message}`);
}

export async function disconnectGbp(userId: string, businessId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      gbp_account_id: null,
      gbp_location_id: null,
      gbp_place_id: null,
      gbp_maps_url: null,
      gbp_address: null,
      gbp_open_status: null,
      gbp_secondary_categories: [],
      gbp_service_area: null,
      gbp_refresh_token: null,
      gbp_access_token: null,
      gbp_token_expires_at: null,
      gbp_connected_at: null,
      gbp_google_email: null,
      onboarding_complete: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", businessId);

  if (error) throw new Error(`Failed to disconnect GBP: ${error.message}`);
}

export async function saveGbpServiceArea(
  userId: string,
  businessId: string,
  serviceArea: GbpPersistedServiceArea
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      gbp_service_area: serviceArea,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", businessId);

  if (error) throw new Error(`Failed to save GBP service area: ${error.message}`);
}

export async function saveManualRankRefreshAt(
  userId: string,
  businessId: string,
  refreshedAt: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      last_manual_rank_refresh_at: refreshedAt,
      updated_at: refreshedAt,
    })
    .eq("user_id", userId)
    .eq("id", businessId);
  if (error) throw new Error(`Failed to save manual rank refresh: ${error.message}`);
}

export async function saveAvgCustomerValue(
  userId: string,
  businessId: string,
  avgCustomerValue: number | null
): Promise<ClientConfig> {
  const supabase = await createClient();
  const value = avgCustomerValue != null && avgCustomerValue > 0 ? avgCustomerValue : null;

  const { data, error } = await supabase
    .from("businesses")
    .update({
      avg_customer_value: value,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to save customer value: ${error.message}`);
  return businessRecordToClientConfig(data as BusinessRecord);
}

export async function updateBusinessKeywords(
  userId: string,
  businessId: string,
  keywords: string[]
): Promise<ClientConfig> {
  const normalized = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length < 3) {
    throw new Error("At least 3 keywords are required.");
  }
  if (normalized.length > 8) {
    throw new Error("Maximum 8 keywords allowed.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({
      keywords: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update keywords: ${error.message}`);
  return businessRecordToClientConfig(data as BusinessRecord);
}

export async function getBusinessIdForSlug(
  userId: string,
  slug: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

export async function updateAutopilotMode(
  userId: string,
  businessId: string,
  mode: AutopilotMode
): Promise<ClientConfig> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({
      autopilot_mode: mode,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update autopilot mode: ${error.message}`);
  return businessRecordToClientConfig(data as BusinessRecord);
}
