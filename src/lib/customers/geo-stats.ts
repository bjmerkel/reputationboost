import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface CustomerGeoCoverageStats {
  totalCustomers: number;
  customersWithGeo: number;
  coveragePercent: number;
}

async function countCustomers(
  businessId: string,
  userId?: string
): Promise<{ total: number; withGeo: number }> {
  const supabase = userId ? await createClient() : createAdminClient();

  let totalQuery = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  let geoQuery = supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .not("grid_north", "is", null)
    .not("grid_east", "is", null);

  if (userId) {
    totalQuery = totalQuery.eq("user_id", userId);
    geoQuery = geoQuery.eq("user_id", userId);
  }

  const [{ count: total }, { count: withGeo }] = await Promise.all([totalQuery, geoQuery]);

  return {
    total: total ?? 0,
    withGeo: withGeo ?? 0,
  };
}

export async function getCustomerGeoCoverageAdmin(
  businessId: string
): Promise<CustomerGeoCoverageStats> {
  const { total, withGeo } = await countCustomers(businessId);
  return {
    totalCustomers: total,
    customersWithGeo: withGeo,
    coveragePercent: total > 0 ? Math.round((withGeo / total) * 100) : 0,
  };
}

export async function getCustomerGeoCoverageForUser(
  userId: string,
  businessId: string
): Promise<CustomerGeoCoverageStats> {
  const { total, withGeo } = await countCustomers(businessId, userId);
  return {
    totalCustomers: total,
    customersWithGeo: withGeo,
    coveragePercent: total > 0 ? Math.round((withGeo / total) * 100) : 0,
  };
}
