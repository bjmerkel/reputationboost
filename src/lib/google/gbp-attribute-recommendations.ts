import type {
  GbpAttributeMetadata,
  GbpAttributeUpdate,
  GbpLocationAttribute,
} from "./gbp-location";
import { attributeKey, isEnabledGbpAttribute } from "./gbp-location";

const HIGH_VALUE_KEYWORDS = [
  "wheelchair",
  "accessible",
  "appointment",
  "online",
  "delivery",
  "pickup",
  "credit",
  "debit",
  "lgbtq",
  "veteran",
  "women",
  "black",
  "latino",
  "asian",
  "emergency",
  "parking",
  "wifi",
  "restroom",
];

function matchesHighValue(meta: GbpAttributeMetadata): boolean {
  const haystack = `${meta.displayName} ${meta.groupDisplayName} ${meta.name}`.toLowerCase();
  return HIGH_VALUE_KEYWORDS.some((kw) => haystack.includes(kw));
}

function isUriAttribute(meta: GbpAttributeMetadata): boolean {
  return meta.valueType.toUpperCase().includes("URI");
}

function isEnumAttribute(meta: GbpAttributeMetadata): boolean {
  const type = meta.valueType.toUpperCase();
  return type.includes("ENUM");
}

/**
 * Recommend attribute updates beyond simple BOOL toggles.
 * Prioritizes high-trust BOOL attributes, then URI links (booking/menu).
 */
export function recommendAttributeUpdates(
  available: GbpAttributeMetadata[],
  current: GbpLocationAttribute[],
  options?: {
    websiteUri?: string;
    limit?: number;
  }
): GbpAttributeUpdate[] {
  const limit = options?.limit ?? 12;
  const enabled = new Set(
    current.filter(isEnabledGbpAttribute).map((a) => attributeKey(a.name))
  );
  const updates: GbpAttributeUpdate[] = [];

  const sorted = [...available].sort((a, b) => {
    const aScore = matchesHighValue(a) ? 1 : 0;
    const bScore = matchesHighValue(b) ? 1 : 0;
    return bScore - aScore;
  });

  for (const meta of sorted) {
    if (updates.length >= limit) break;
    if (meta.deprecated) continue;
    if (enabled.has(attributeKey(meta.name))) continue;

    if (meta.valueType === "BOOL") {
      updates.push({ name: meta.name, boolValue: true });
      continue;
    }

    if (isUriAttribute(meta) && options?.websiteUri) {
      const haystack = `${meta.displayName} ${meta.name}`.toLowerCase();
      if (haystack.includes("appointment") || haystack.includes("booking") || haystack.includes("menu")) {
        updates.push({ name: meta.name, uri: options.websiteUri });
      }
    }
  }

  // Second pass: enable remaining BOOL attributes if room
  if (updates.length < limit) {
    for (const meta of sorted) {
      if (updates.length >= limit) break;
      if (meta.deprecated || meta.valueType !== "BOOL") continue;
      if (enabled.has(attributeKey(meta.name))) continue;
      if (updates.some((u) => u.name === meta.name)) continue;
      updates.push({ name: meta.name, boolValue: true });
    }
  }

  return updates;
}

/** Booking / appointment URI attributes only (step 15). */
export function recommendBookingAttributes(
  available: GbpAttributeMetadata[],
  current: GbpLocationAttribute[],
  bookingUri: string
): GbpAttributeUpdate[] {
  const enabled = new Set(
    current.filter(isEnabledGbpAttribute).map((a) => attributeKey(a.name))
  );
  const updates: GbpAttributeUpdate[] = [];
  const uri = bookingUri.trim();
  if (!uri) return updates;

  for (const meta of available) {
    if (meta.deprecated || !isUriAttribute(meta)) continue;
    if (enabled.has(attributeKey(meta.name))) continue;
    const haystack = `${meta.displayName} ${meta.name}`.toLowerCase();
    if (
      haystack.includes("appointment") ||
      haystack.includes("booking") ||
      haystack.includes("reserv")
    ) {
      updates.push({ name: meta.name, uri });
    }
  }

  return updates;
}

/** Count how many recommended attributes are not yet enabled. */
export function countMissingRecommendedAttributes(
  available: GbpAttributeMetadata[],
  current: GbpLocationAttribute[]
): number {
  return recommendAttributeUpdates(available, current, { limit: 50 }).length;
}
