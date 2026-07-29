import { cookies } from "next/headers";
import {
  businessRecordToClientConfig,
  getBusinessRecord,
  getPrimaryBusiness,
  listUserBusinesses,
  type BusinessRecord,
} from "@/audit/businesses";
import type { ClientConfig } from "@/audit/types";
import {
  ACTIVE_BUSINESS_COOKIE,
  type BusinessSummary,
} from "@/lib/business/active-business-shared";

export { ACTIVE_BUSINESS_COOKIE, type BusinessSummary } from "@/lib/business/active-business-shared";
export { withBusinessId } from "@/lib/business/active-business-shared";

export function businessRecordToSummary(row: BusinessRecord): BusinessSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.location?.city ?? "",
    state: row.location?.state ?? "",
    onboardingComplete: row.onboarding_complete,
    gbpConnected: Boolean(row.gbp_location_id),
    googleEmail: row.gbp_google_email,
  };
}

export async function listBusinessSummaries(userId: string): Promise<BusinessSummary[]> {
  const rows = await listUserBusinesses(userId);
  return rows.map(businessRecordToSummary);
}

export async function resolveActiveBusinessId(
  userId: string,
  preferredBusinessId?: string | null
): Promise<string | null> {
  const rows = await listUserBusinesses(userId);
  if (rows.length === 0) return null;

  if (preferredBusinessId && rows.some((row) => row.id === preferredBusinessId)) {
    return preferredBusinessId;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  if (fromCookie && rows.some((row) => row.id === fromCookie)) {
    return fromCookie;
  }

  const primary = await getPrimaryBusiness(userId);
  return primary?.businessId ?? rows[rows.length - 1]?.id ?? null;
}

export async function getActiveBusiness(
  userId: string,
  preferredBusinessId?: string | null
): Promise<ClientConfig | null> {
  const businessId = await resolveActiveBusinessId(userId, preferredBusinessId);
  if (!businessId) return null;

  const record = await getBusinessRecord(userId, businessId);
  return record ? businessRecordToClientConfig(record) : null;
}
