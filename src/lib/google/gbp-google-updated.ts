import type { GbpGoogleSuggestion } from "@/audit/types";

const FIELD_LABELS: Record<string, string> = {
  title: "Business name",
  "profile.description": "Description",
  "phoneNumbers.primaryPhone": "Phone",
  websiteUri: "Website",
  "categories.primaryCategory": "Primary category",
  "storefrontAddress": "Address",
  regularHours: "Regular hours",
  specialHours: "Holiday hours",
};

export const ATTRIBUTE_SUGGESTION_PREFIX = "attribute:";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && value !== null && "displayName" in value) {
    return String((value as { displayName?: string }).displayName ?? "");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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

/** Compare owner location vs Google-updated snapshot. */
export function diffGoogleUpdatedLocation(
  owner: Record<string, unknown>,
  googleUpdated: Record<string, unknown>
): GbpGoogleSuggestion[] {
  const suggestions: GbpGoogleSuggestion[] = [];

  for (const field of DIFF_PATHS) {
    const ownerValue = stringifyValue(getNestedValue(owner, field));
    const googleValue = stringifyValue(getNestedValue(googleUpdated, field));

    if (!googleValue) continue;
    if (ownerValue === googleValue) continue;

    suggestions.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      ownerValue: ownerValue || "(not set)",
      googleValue,
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
    });
  }

  return suggestions;
}
