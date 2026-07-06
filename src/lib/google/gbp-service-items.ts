import { stripPhoneNumbersFromText, stripUrlsFromText } from "./gbp-description";

/**
 * Structured offering data for Google Business Profile.
 *
 * Services are published through the Business Information v1 API as
 * `serviceItems` on the Location (locations.patch with
 * updateMask=serviceItems). The v4 priceLists API is deprecated in favor of
 * this — do not use priceLists for services.
 *
 * Hard-won API rules encoded here:
 * - `freeFormServiceItem.category` must be the category's stable ID
 *   ("gcid:car_repair"), NOT the resource name ("categories/gcid:car_repair").
 *   Sending the resource name fails with INVALID_ARGUMENT.
 * - Updating individual services is not supported — every patch must replace
 *   the full serviceItems list.
 * - Display names must be unique across items (SERVICE_ITEM_LABEL_DUPLICATE_DISPLAY_NAME)
 *   and serviceTypeIds must be unique (SERVICE_TYPE_ID_DUPLICATE).
 * - Google recommends names ≤ 140 chars and free-form descriptions ≤ 250;
 *   structured descriptions are capped at 300.
 */
export const SERVICE_NAME_MAX_LENGTH = 140;
export const FREE_FORM_DESCRIPTION_MAX_LENGTH = 250;
export const STRUCTURED_DESCRIPTION_MAX_LENGTH = 300;

/** "categories/gcid:x" | "gcid:x" | "x" → "gcid:x" (stable category ID). */
export function categoryStableId(categoryName: string): string {
  const stripped = categoryName.replace(/^categories\//, "");
  return stripped.startsWith("gcid:") ? stripped : `gcid:${stripped}`;
}

/** Plain text only: no URLs or phone numbers, collapsed whitespace, capped length. */
export function sanitizeServiceText(text: string, maxLength: number): string {
  const { text: withoutUrls } = stripUrlsFromText(text);
  const { text: withoutPhones } = stripPhoneNumbersFromText(withoutUrls);
  const normalized = withoutPhones.trim().replace(/\s+/g, " ");
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

export interface ServiceAddition {
  name: string;
  description: string;
  /** Google structured service type (e.g. "job_type_id:oil_change") when resolved. */
  serviceTypeId?: string | null;
}

export function buildStructuredServiceItem(
  serviceTypeId: string,
  description: string
): Record<string, unknown> {
  const item: Record<string, unknown> = {
    structuredServiceItem: { serviceTypeId },
  };
  const cleaned = sanitizeServiceText(description, STRUCTURED_DESCRIPTION_MAX_LENGTH);
  if (cleaned) {
    (item.structuredServiceItem as Record<string, unknown>).description = cleaned;
  }
  return item;
}

export function buildFreeFormServiceItem(
  categoryName: string,
  name: string,
  description: string
): Record<string, unknown> {
  const label: Record<string, unknown> = {
    displayName: sanitizeServiceText(name, SERVICE_NAME_MAX_LENGTH),
  };
  const cleaned = sanitizeServiceText(description, FREE_FORM_DESCRIPTION_MAX_LENGTH);
  if (cleaned) label.description = cleaned;

  return {
    freeFormServiceItem: {
      category: categoryStableId(categoryName),
      label,
    },
  };
}

interface RawServiceItem {
  structuredServiceItem?: { serviceTypeId?: string; description?: string };
  freeFormServiceItem?: {
    category?: string;
    categoryId?: string;
    label?: { displayName?: string; description?: string; languageCode?: string };
  };
  price?: Record<string, unknown>;
}

/**
 * Normalize an existing item (as returned by locations.get) so it is valid to
 * send back in a patch: fix the category format and drop unknown fields.
 * Returns null for items that would fail INVALID_SERVICE_ITEM.
 */
export function normalizeServiceItemForPatch(
  raw: Record<string, unknown>
): Record<string, unknown> | null {
  const item = raw as RawServiceItem;

  if (item.structuredServiceItem?.serviceTypeId) {
    const structured: Record<string, unknown> = {
      serviceTypeId: item.structuredServiceItem.serviceTypeId,
    };
    if (item.structuredServiceItem.description) {
      structured.description = item.structuredServiceItem.description.slice(
        0,
        STRUCTURED_DESCRIPTION_MAX_LENGTH
      );
    }
    const result: Record<string, unknown> = { structuredServiceItem: structured };
    if (item.price) result.price = item.price;
    return result;
  }

  const freeForm = item.freeFormServiceItem;
  const category = freeForm?.category ?? freeForm?.categoryId;
  const displayName = freeForm?.label?.displayName;
  if (!category || !displayName) return null;

  const label: Record<string, unknown> = { displayName };
  if (freeForm.label?.description) label.description = freeForm.label.description;
  if (freeForm.label?.languageCode) label.languageCode = freeForm.label.languageCode;

  const result: Record<string, unknown> = {
    freeFormServiceItem: {
      category: categoryStableId(category),
      label,
    },
  };
  if (item.price) result.price = item.price;
  return result;
}

function itemDisplayName(item: Record<string, unknown>): string | null {
  const freeForm = (item as RawServiceItem).freeFormServiceItem;
  return freeForm?.label?.displayName ?? null;
}

function itemServiceTypeId(item: Record<string, unknown>): string | null {
  return (item as RawServiceItem).structuredServiceItem?.serviceTypeId ?? null;
}

export interface ServiceItemsPatch {
  serviceItems: Array<Record<string, unknown>>;
  /** Display names of services that will be added by this patch. */
  added: string[];
  /** Services skipped because they already exist on the profile. */
  skipped: string[];
}

/**
 * Build the full serviceItems list for a patch: existing items (normalized)
 * plus new additions, deduplicated by display name and serviceTypeId.
 */
export function buildServiceItemsPatch(options: {
  existingRaw: Array<Record<string, unknown>>;
  primaryCategoryName: string;
  additions: ServiceAddition[];
}): ServiceItemsPatch {
  const serviceItems: Array<Record<string, unknown>> = [];
  const seenNames = new Set<string>();
  const seenTypeIds = new Set<string>();

  for (const raw of options.existingRaw) {
    const normalized = normalizeServiceItemForPatch(raw);
    if (!normalized) continue;

    const name = itemDisplayName(normalized)?.toLowerCase();
    const typeId = itemServiceTypeId(normalized);
    if (name && seenNames.has(name)) continue;
    if (typeId && seenTypeIds.has(typeId)) continue;
    if (name) seenNames.add(name);
    if (typeId) seenTypeIds.add(typeId);
    serviceItems.push(normalized);
  }

  const added: string[] = [];
  const skipped: string[] = [];

  for (const addition of options.additions) {
    const cleanName = sanitizeServiceText(addition.name, SERVICE_NAME_MAX_LENGTH);
    if (!cleanName) {
      skipped.push(addition.name);
      continue;
    }

    if (addition.serviceTypeId) {
      if (seenTypeIds.has(addition.serviceTypeId)) {
        skipped.push(cleanName);
        continue;
      }
      seenTypeIds.add(addition.serviceTypeId);
      seenNames.add(cleanName.toLowerCase());
      serviceItems.push(buildStructuredServiceItem(addition.serviceTypeId, addition.description));
      added.push(cleanName);
      continue;
    }

    if (seenNames.has(cleanName.toLowerCase())) {
      skipped.push(cleanName);
      continue;
    }
    seenNames.add(cleanName.toLowerCase());
    serviceItems.push(
      buildFreeFormServiceItem(options.primaryCategoryName, cleanName, addition.description)
    );
    added.push(cleanName);
  }

  return { serviceItems, added, skipped };
}

/** Names (lowercased) of services currently live, for post-patch verification. */
export function liveServiceNameSet(
  serviceItems: Array<{ name: string }>,
  serviceLabels?: Map<string, string>
): Set<string> {
  const names = new Set<string>();
  for (const item of serviceItems) {
    names.add(item.name.toLowerCase());
    const label = serviceLabels?.get(item.name);
    if (label) names.add(label.toLowerCase());
  }
  return names;
}
