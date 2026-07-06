import { normalizePhoneE164 } from "@/lib/sms/phone";
import type { ImportCustomerRow } from "./types";

const HEADER_ALIASES: Record<string, keyof ImportCustomerRow> = {
  first_name: "firstName",
  firstname: "firstName",
  first: "firstName",
  given_name: "firstName",
  last_name: "lastName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  family_name: "lastName",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  cell: "phone",
  telephone: "phone",
  tel: "phone",
  email: "email",
  email_address: "email",
  service: "serviceNotes",
  service_notes: "serviceNotes",
  notes: "serviceNotes",
  job: "serviceNotes",
  last_service: "lastServiceDate",
  last_service_date: "lastServiceDate",
  service_date: "lastServiceDate",
  date: "lastServiceDate",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export interface CsvParseResult {
  rows: ImportCustomerRow[];
  skipped: number;
  errors: string[];
}

export function parseCustomerCsv(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], skipped: 0, errors: ["CSV file is empty"] };
  }

  const headerFields = parseCsvLine(lines[0]);
  const columnMap: Array<keyof ImportCustomerRow | "name" | null> = headerFields.map((header) => {
    const normalized = normalizeHeader(header);
    if (normalized === "name" || normalized === "full_name" || normalized === "customer_name") {
      return "name";
    }
    return HEADER_ALIASES[normalized] ?? null;
  });

  const phoneIndex = columnMap.indexOf("phone");
  if (phoneIndex === -1) {
    return { rows: [], skipped: 0, errors: ["CSV must include a phone column"] };
  }

  const rows: ImportCustomerRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const row: Partial<ImportCustomerRow> = {};

    columnMap.forEach((key, index) => {
      const value = fields[index]?.trim();
      if (!value || !key) return;
      if (key === "name") {
        const { firstName, lastName } = splitFullName(value);
        row.firstName = firstName;
        row.lastName = lastName;
      } else {
        row[key] = value;
      }
    });

    const phone = row.phone?.trim();
    if (!phone) {
      skipped++;
      continue;
    }

    if (!normalizePhoneE164(phone)) {
      errors.push(`Row ${i + 1}: invalid phone "${phone}"`);
      skipped++;
      continue;
    }

    rows.push({
      firstName: row.firstName?.trim() ?? "",
      lastName: row.lastName?.trim() ?? "",
      phone,
      email: row.email?.trim(),
      serviceNotes: row.serviceNotes?.trim(),
      lastServiceDate: row.lastServiceDate?.trim(),
    });
  }

  return { rows, skipped, errors };
}

export function parseCustomerJson(data: unknown): CsvParseResult {
  if (!Array.isArray(data)) {
    return { rows: [], skipped: 0, errors: ["JSON must be an array of customer objects"] };
  }

  const rows: ImportCustomerRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  data.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      skipped++;
      return;
    }

    const record = item as Record<string, unknown>;
    const phone = String(record.phone ?? record.phoneNumber ?? "").trim();
    if (!phone) {
      skipped++;
      return;
    }

    if (!normalizePhoneE164(phone)) {
      errors.push(`Row ${index + 1}: invalid phone "${phone}"`);
      skipped++;
      return;
    }

    const fullName = String(record.name ?? record.fullName ?? "").trim();
    const firstName = String(record.firstName ?? record.first_name ?? "").trim();
    const lastName = String(record.lastName ?? record.last_name ?? "").trim();

    rows.push({
      firstName: firstName || (fullName ? splitFullName(fullName).firstName : ""),
      lastName: lastName || (fullName ? splitFullName(fullName).lastName : ""),
      phone,
      email: String(record.email ?? "").trim() || undefined,
      serviceNotes: String(record.serviceNotes ?? record.service ?? record.notes ?? "").trim() || undefined,
      lastServiceDate:
        String(record.lastServiceDate ?? record.last_service_date ?? "").trim() || undefined,
    });
  });

  return { rows, skipped, errors };
}
