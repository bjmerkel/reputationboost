import type { GbpGoogleSuggestion } from "@/audit/types";

const FIELD_LABELS: Record<string, string> = {
  title: "Business name",
  "profile.description": "Description",
  "phoneNumbers.primaryPhone": "Phone",
  websiteUri: "Website",
  "categories.primaryCategory": "Primary category",
  storefrontAddress: "Address",
  regularHours: "Regular hours",
  specialHours: "Holiday hours",
  serviceItems: "Services",
};

export const ATTRIBUTE_SUGGESTION_PREFIX = "attribute:";

export interface GbpPostalAddress {
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
  regionCode?: string;
  languageCode?: string;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Human-readable postal address for diffs/UI (avoids raw JSON float/shape noise). */
export function formatPostalAddress(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const addr = value as GbpPostalAddress;
  const street = addr.addressLines?.filter(Boolean).join(", ") ?? "";
  const regionLine = [addr.administrativeArea, addr.postalCode].filter(Boolean).join(" ");
  return [street, addr.locality, regionLine].filter(Boolean).join(", ");
}

function looksLikePostalAddress(value: unknown): value is GbpPostalAddress {
  if (!value || typeof value !== "object") return false;
  const addr = value as GbpPostalAddress;
  return Boolean(
    addr.addressLines ||
      addr.locality ||
      addr.administrativeArea ||
      addr.postalCode ||
      addr.regionCode
  );
}

/** Normalize address strings so structured vs flattened forms can match. */
export function normalizeAddressForCompare(value: unknown): string {
  const formatted =
    typeof value === "string"
      ? value
      : looksLikePostalAddress(value)
        ? formatPostalAddress(value)
        : stringifyValue(value);
  return formatted
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(united states|usa|us)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && value !== null && "displayName" in value) {
    return String((value as { displayName?: string }).displayName ?? "");
  }
  if (looksLikePostalAddress(value)) {
    return formatPostalAddress(value) || JSON.stringify(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function valuesEquivalent(field: string, ownerValue: unknown, googleValue: unknown): boolean {
  if (field === "storefrontAddress" || field.startsWith("storefrontAddress.")) {
    const ownerNorm = normalizeAddressForCompare(ownerValue);
    const googleNorm = normalizeAddressForCompare(googleValue);
    if (ownerNorm && googleNorm && ownerNorm === googleNorm) return true;
  }
  return stringifyValue(ownerValue) === stringifyValue(googleValue);
}
const DIFF_PATHS = [
  "title",
  "profile.description",
  "phoneNumbers.primaryPhone",
  "websiteUri",
  "categories.primaryCategory",
  "storefrontAddress",
  "regularHours",
  "specialHours",
];

/** Parse comma-separated update masks from getGoogleUpdated. */
export function parseUpdateMask(mask: string | undefined): string[] {
  if (!mask?.trim()) return [];
  return mask
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Whether a field appears in an update mask (exact or nested path). */
export function maskIncludesField(mask: string | undefined, field: string): boolean {
  const fields = parseUpdateMask(mask);
  return fields.some(
    (entry) => entry === field || field.startsWith(`${entry}.`) || entry.startsWith(`${field}.`)
  );
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Build diff suggestions from Google's diffMask. */
export function suggestionsFromDiffMask(
  owner: Record<string, unknown>,
  googleLocation: Record<string, unknown>,
  diffMask: string
): GbpGoogleSuggestion[] {
  const fields = parseUpdateMask(diffMask);
  const suggestions: GbpGoogleSuggestion[] = [];

  for (const field of fields) {
    const ownerValue = stringifyValue(getNestedValue(owner, field));
    const googleValue = stringifyValue(getNestedValue(googleLocation, field));
    if (!googleValue && !ownerValue) continue;

    suggestions.push({
      field,
      label: fieldLabel(field),
      ownerValue: ownerValue || "(not set)",
      googleValue: googleValue || "(not set)",
      kind: "diff",
    });
  }

  return suggestions;
}

/** Build pending suggestions from Google's pendingMask (owner update processing). */
export function pendingFieldsFromMask(
  owner: Record<string, unknown>,
  pendingMask: string
): GbpGoogleSuggestion[] {
  return parseUpdateMask(pendingMask).map((field) => ({
    field,
    label: fieldLabel(field),
    ownerValue: stringifyValue(getNestedValue(owner, field)) || "(not set)",
    googleValue: "",
    kind: "pending",
  }));
}

/**
 * Compare owner location vs Google-updated snapshot.
 * Only used as a last-resort fallback — prefer Google's diffMask.
 * Address comparisons are normalized so structured vs flattened forms do not
 * create false conflicts that cannot be approved.
 */
export function diffGoogleUpdatedLocation(
  owner: Record<string, unknown>,
  googleUpdated: Record<string, unknown>
): GbpGoogleSuggestion[] {
  const suggestions: GbpGoogleSuggestion[] = [];

  for (const field of DIFF_PATHS) {
    const ownerRaw = getNestedValue(owner, field);
    const googleRaw = getNestedValue(googleUpdated, field);
    const ownerValue = stringifyValue(ownerRaw);
    const googleValue = stringifyValue(googleRaw);

    if (!googleValue) continue;
    if (valuesEquivalent(field, ownerRaw, googleRaw)) continue;

    suggestions.push({
      field,
      label: fieldLabel(field),
      ownerValue: ownerValue || "(not set)",
      googleValue,
      kind: "diff",
    });
  }

  return suggestions;
}

export interface AttributeSuggestionInput {
  name: string;
  label: string;
  ownerSummary: string;
  googleSummary: string;
}

/** Compare owner vs Google-updated attribute snapshots. */
export function diffGoogleUpdatedAttributes(
  attributes: AttributeSuggestionInput[]
): GbpGoogleSuggestion[] {
  const suggestions: GbpGoogleSuggestion[] = [];

  for (const attribute of attributes) {
    if (!attribute.googleSummary) continue;
    if (attribute.ownerSummary === attribute.googleSummary) continue;

    suggestions.push({
      field: `${ATTRIBUTE_SUGGESTION_PREFIX}${attribute.name}`,
      label: attribute.label,
      ownerValue: attribute.ownerSummary || "(not set)",
      googleValue: attribute.googleSummary,
      kind: "diff",
    });
  }

  return suggestions;
}

export function isGoogleUpdateResolved(diffMask: string, hasGoogleUpdated: boolean): boolean {
  return !diffMask.trim() && !hasGoogleUpdated;
}

export { stringifyValue, getNestedValue };
