import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCustomerContact } from "@/lib/customers/contact";
import { IMPORT_CHUNK_SIZE } from "@/lib/review-requests/bulk-config";
import type { ImportCustomerRow } from "@/lib/customers/types";

export interface BulkImportResult {
  imported: number;
  updated: number;
  failed: number;
}

interface PreparedCustomerRow {
  phone: string | null;
  email: string | null;
  row: Record<string, unknown>;
}

function dedupeImportRows(rows: ImportCustomerRow[]): {
  rows: ImportCustomerRow[];
  failed: number;
} {
  const byKey = new Map<string, ImportCustomerRow>();
  let failed = 0;

  for (const row of rows) {
    try {
      const { phone, email } = normalizeCustomerContact({
        phone: row.phone,
        email: row.email,
      });
      const key = phone ?? (email ? email.toLowerCase() : "");
      if (!key) {
        failed++;
        continue;
      }
      byKey.set(key, row);
    } catch {
      failed++;
    }
  }

  return { rows: Array.from(byKey.values()), failed };
}

function prepareCustomerRow(
  userId: string,
  businessId: string,
  row: ImportCustomerRow,
  updatedAt: string
): PreparedCustomerRow | null {
  try {
    const { phone, email } = normalizeCustomerContact({
      phone: row.phone,
      email: row.email,
    });

    return {
      phone,
      email,
      row: {
        business_id: businessId,
        user_id: userId,
        first_name: row.firstName?.trim() ?? "",
        last_name: row.lastName?.trim() ?? "",
        phone,
        email,
        service_notes: row.serviceNotes?.trim() || null,
        last_service_date: row.lastServiceDate || null,
        source: "import",
        updated_at: updatedAt,
      },
    };
  } catch {
    return null;
  }
}

async function loadExistingContactMaps(
  supabase: SupabaseClient,
  businessId: string
): Promise<{ phoneToId: Map<string, string>; emailToId: Map<string, string> }> {
  const phoneToId = new Map<string, string>();
  const emailToId = new Map<string, string>();

  const { data, error } = await supabase
    .from("customers")
    .select("id, phone, email")
    .eq("business_id", businessId);

  if (error) throw new Error(error.message);

  for (const existing of data ?? []) {
    const id = existing.id as string;
    const phone = existing.phone as string | null;
    const email = existing.email as string | null;
    if (phone?.trim()) phoneToId.set(phone, id);
    if (email?.trim()) emailToId.set(email.toLowerCase(), id);
  }

  return { phoneToId, emailToId };
}

function resolveExistingId(
  phone: string | null,
  email: string | null,
  phoneToId: Map<string, string>,
  emailToId: Map<string, string>
): string | null {
  if (phone && phoneToId.has(phone)) return phoneToId.get(phone) ?? null;
  if (email && emailToId.has(email.toLowerCase())) {
    return emailToId.get(email.toLowerCase()) ?? null;
  }
  return null;
}

async function batchInsertCustomers(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[]
): Promise<string[]> {
  if (rows.length === 0) return [];

  const { data, error } = await supabase.from("customers").insert(rows).select("id, phone, email");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => row.id as string);
}

export async function bulkImportCustomers(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
  rows: ImportCustomerRow[]
): Promise<BulkImportResult> {
  const { rows: dedupedRows, failed: dedupeFailed } = dedupeImportRows(rows);
  const updatedAt = new Date().toISOString();

  const { phoneToId, emailToId } = await loadExistingContactMaps(supabase, businessId);

  const inserts: Record<string, unknown>[] = [];
  const updates: Array<{ id: string; row: Record<string, unknown> }> = [];
  let failed = dedupeFailed;

  for (const importRow of dedupedRows) {
    const prepared = prepareCustomerRow(userId, businessId, importRow, updatedAt);
    if (!prepared) {
      failed++;
      continue;
    }

    const existingId = resolveExistingId(
      prepared.phone,
      prepared.email,
      phoneToId,
      emailToId
    );

    if (existingId) {
      updates.push({ id: existingId, row: prepared.row });
    } else {
      inserts.push(prepared.row);
      if (prepared.phone) phoneToId.set(prepared.phone, "__pending__");
      if (prepared.email) emailToId.set(prepared.email.toLowerCase(), "__pending__");
    }
  }

  let imported = 0;
  let updated = 0;

  for (let i = 0; i < inserts.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = inserts.slice(i, i + IMPORT_CHUNK_SIZE);
    try {
      const ids = await batchInsertCustomers(supabase, chunk);
      imported += ids.length;
    } catch {
      failed += chunk.length;
    }
  }

  for (const { id, row } of updates) {
    try {
      const { error } = await supabase.from("customers").update(row).eq("id", id);
      if (error) throw new Error(error.message);
      updated++;
    } catch {
      failed++;
    }
  }

  return { imported, updated, failed };
}
