import { normalizeCustomerContact } from "@/lib/customers/contact";
import { MAX_CSV_ROWS } from "@/lib/review-requests/bulk-config";
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

function parseContactRow(input: {
  phone?: string;
  email?: string;
  rowLabel: string;
  errors: string[];
}): { phone?: string; email?: string } | null {
  const phoneRaw = input.phone?.trim();
  const emailRaw = input.email?.trim();

  if (!phoneRaw && !emailRaw) {
    return null;
  }

  try {
    const normalized = normalizeCustomerContact({
      phone: phoneRaw,
      email: emailRaw,
    });
    return {
      phone: normalized.phone ?? undefined,
      email: normalized.email ?? undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid contact";
    input.errors.push(`${input.rowLabel}: ${message}`);
    return null;
  }
}

export interface CsvParseResult {
  rows: ImportCustomerRow[];
  skipped: number;
  errors: string[];
}

export type CsvColumnKey = keyof ImportCustomerRow | "name" | null;
export type CsvColumnMap = CsvColumnKey[];

function splitCsvLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildColumnMap(headerLine: string): { columnMap: CsvColumnMap } | { errors: string[] } {
  const headerFields = parseCsvLine(headerLine);
  const columnMap: CsvColumnMap = headerFields.map((header) => {
    const normalized = normalizeHeader(header);
    if (normalized === "name" || normalized === "full_name" || normalized === "customer_name") {
      return "name";
    }
    return HEADER_ALIASES[normalized] ?? null;
  });

  const hasPhoneColumn = columnMap.includes("phone");
  const hasEmailColumn = columnMap.includes("email");
  if (!hasPhoneColumn && !hasEmailColumn) {
    return { errors: ["CSV must include a phone or email column"] };
  }

  return { columnMap };
}

export function countCsvDataRows(text: string): number {
  const lines = splitCsvLines(text);
  return Math.max(0, lines.length - 1);
}

export function validateCsvForImport(text: string): { ok: true } | { ok: false; errors: string[] } {
  const lines = splitCsvLines(text);
  if (lines.length === 0) {
    return { ok: false, errors: ["CSV file is empty"] };
  }

  const header = buildColumnMap(lines[0]);
  if ("errors" in header) {
    return { ok: false, errors: header.errors };
  }

  return { ok: true };
}

export interface CsvChunkParseResult {
  rows: ImportCustomerRow[];
  skipped: number;
  errors: string[];
  linesConsumed: number;
  done: boolean;
}

export function parseCustomerCsvChunk(
  text: string,
  dataLineOffset: number,
  maxLines: number
): CsvChunkParseResult {
  const lines = splitCsvLines(text);
  if (lines.length === 0) {
    return { rows: [], skipped: 0, errors: ["CSV file is empty"], linesConsumed: 0, done: true };
  }

  const header = buildColumnMap(lines[0]);
  if ("errors" in header) {
    return {
      rows: [],
      skipped: 0,
      errors: header.errors,
      linesConsumed: 0,
      done: true,
    };
  }

  const columnMap = header.columnMap;
  const rows: ImportCustomerRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  const startLine = 1 + dataLineOffset;
  const endLine = Math.min(lines.length, startLine + maxLines);
  let linesConsumed = 0;

  for (let i = startLine; i < endLine; i++) {
    linesConsumed++;
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

    const contact = parseContactRow({
      phone: row.phone,
      email: row.email,
      rowLabel: `Row ${i + 1}`,
      errors,
    });
    if (!contact) {
      skipped++;
      continue;
    }

    rows.push({
      firstName: row.firstName?.trim() ?? "",
      lastName: row.lastName?.trim() ?? "",
      phone: contact.phone,
      email: contact.email,
      serviceNotes: row.serviceNotes?.trim(),
      lastServiceDate: row.lastServiceDate?.trim(),
    });
  }

  return {
    rows,
    skipped,
    errors,
    linesConsumed,
    done: endLine >= lines.length,
  };
}

export interface JsonChunkParseResult {
  rows: ImportCustomerRow[];
  skipped: number;
  errors: string[];
  itemsConsumed: number;
  done: boolean;
}

export function parseCustomerJsonChunk(
  data: unknown[],
  offset: number,
  maxItems: number
): JsonChunkParseResult {
  const slice = data.slice(offset, offset + maxItems);
  const parsed = parseCustomerJson(slice);
  return {
    rows: parsed.rows,
    skipped: parsed.skipped,
    errors: parsed.errors,
    itemsConsumed: slice.length,
    done: offset + maxItems >= data.length,
  };
}

export function enforceImportRowLimit(rowCount: number): string | null {
  if (rowCount <= MAX_CSV_ROWS) return null;
  return `Import exceeds the maximum of ${MAX_CSV_ROWS.toLocaleString()} rows. Split the file or contact support for larger imports.`;
}

export function parseCustomerCsv(text: string): CsvParseResult {
  const lines = splitCsvLines(text);

  if (lines.length === 0) {
    return { rows: [], skipped: 0, errors: ["CSV file is empty"] };
  }

  const header = buildColumnMap(lines[0]);
  if ("errors" in header) {
    return { rows: [], skipped: 0, errors: header.errors };
  }

  const columnMap = header.columnMap;
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

    const contact = parseContactRow({
      phone: row.phone,
      email: row.email,
      rowLabel: `Row ${i + 1}`,
      errors,
    });
    if (!contact) {
      skipped++;
      continue;
    }

    rows.push({
      firstName: row.firstName?.trim() ?? "",
      lastName: row.lastName?.trim() ?? "",
      phone: contact.phone,
      email: contact.email,
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
    const phone = String(record.phone ?? record.phoneNumber ?? "").trim() || undefined;
    const email = String(record.email ?? "").trim() || undefined;
    const contact = parseContactRow({
      phone,
      email,
      rowLabel: `Row ${index + 1}`,
      errors,
    });
    if (!contact) {
      skipped++;
      return;
    }

    const fullName = String(record.name ?? record.fullName ?? "").trim();
    const firstName = String(record.firstName ?? record.first_name ?? "").trim();
    const lastName = String(record.lastName ?? record.last_name ?? "").trim();

    rows.push({
      firstName: firstName || (fullName ? splitFullName(fullName).firstName : ""),
      lastName: lastName || (fullName ? splitFullName(fullName).lastName : ""),
      phone: contact.phone,
      email: contact.email,
      serviceNotes: String(record.serviceNotes ?? record.service ?? record.notes ?? "").trim() || undefined,
      lastServiceDate:
        String(record.lastServiceDate ?? record.last_service_date ?? "").trim() || undefined,
    });
  });

  return { rows, skipped, errors };
}
