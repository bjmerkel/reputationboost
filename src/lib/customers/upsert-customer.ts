import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCustomerContact } from "@/lib/customers/contact";
import type { CustomerInput, CustomerRecord } from "@/lib/customers/types";

function rowToRecord(row: Record<string, unknown>): CustomerRecord {
  return row as unknown as CustomerRecord;
}

async function findExistingCustomerId(
  supabase: SupabaseClient,
  businessId: string,
  phone: string | null,
  email: string | null
): Promise<string | null> {
  if (phone) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("phone", phone)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", email)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

export async function upsertCustomerRecord(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
  input: CustomerInput
): Promise<CustomerRecord> {
  const { phone, email } = normalizeCustomerContact(input);
  const existingId = await findExistingCustomerId(supabase, businessId, phone, email);

  const row: Record<string, unknown> = {
    business_id: businessId,
    user_id: userId,
    first_name: input.firstName?.trim() ?? "",
    last_name: input.lastName?.trim() ?? "",
    phone,
    email,
    service_notes: input.serviceNotes?.trim() || null,
    last_service_date: input.lastServiceDate || null,
    source: input.source ?? "manual",
    updated_at: new Date().toISOString(),
  };

  if (input.serviceAddress !== undefined) row.service_address = input.serviceAddress?.trim() || null;
  if (input.serviceCity !== undefined) row.service_city = input.serviceCity?.trim() || null;
  if (input.serviceZip !== undefined) row.service_zip = input.serviceZip?.trim() || null;
  if (input.serviceLat !== undefined) row.service_lat = input.serviceLat ?? null;
  if (input.serviceLng !== undefined) row.service_lng = input.serviceLng ?? null;
  if (input.gridNorth !== undefined) row.grid_north = input.gridNorth ?? null;
  if (input.gridEast !== undefined) row.grid_east = input.gridEast ?? null;
  if (input.geoResolvedAt !== undefined) row.geo_resolved_at = input.geoResolvedAt ?? null;

  if (existingId) {
    const { data, error } = await supabase
      .from("customers")
      .update(row)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToRecord(data);
  }

  const { data, error } = await supabase.from("customers").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return rowToRecord(data);
}
