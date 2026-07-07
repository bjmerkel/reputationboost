import type { GbpAttributeCoverage } from "@/audit/types";
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

const ATTRIBUTE_BATCH_SIZE = 25;

function matchesHighValue(meta: GbpAttributeMetadata): boolean {
  const haystack = `${meta.displayName} ${meta.groupDisplayName} ${meta.name}`.toLowerCase();
  return HIGH_VALUE_KEYWORDS.some((kw) => haystack.includes(kw));
}

function isUriAttribute(meta: GbpAttributeMetadata): boolean {
  const type = meta.valueType.toUpperCase();
  return type.includes("URI") || type === "URL";
}

function sortByPriority(
  available: GbpAttributeMetadata[],
  missingKeys: Set<string>
): GbpAttributeMetadata[] {
  return [...available]
    .filter((meta) => !meta.deprecated && missingKeys.has(attributeKey(meta.name)))
    .sort((a, b) => {
      const aScore = matchesHighValue(a) ? 1 : 0;
      const bScore = matchesHighValue(b) ? 1 : 0;
      if (bScore !== aScore) return bScore - aScore;
      if (a.valueType === "BOOL" && b.valueType !== "BOOL") return -1;
      if (b.valueType === "BOOL" && a.valueType !== "BOOL") return 1;
      return a.displayName.localeCompare(b.displayName);
    });
}

function buildAutoUpdate(
  meta: GbpAttributeMetadata,
  websiteUri?: string
): GbpAttributeUpdate | null {
  if (meta.valueType === "BOOL") {
    return { name: meta.name, boolValue: true };
  }

  if (isUriAttribute(meta) && websiteUri) {
    const haystack = `${meta.displayName} ${meta.name}`.toLowerCase();
    if (
      haystack.includes("appointment") ||
      haystack.includes("booking") ||
      haystack.includes("menu") ||
      haystack.includes("reserv")
    ) {
      return { name: meta.name, uri: websiteUri };
    }
  }

  return null;
}

/** Compare available GBP attributes against what is enabled on the profile. */
export function buildAttributeCoverage(
  available: GbpAttributeMetadata[],
  current: GbpLocationAttribute[],
  options?: {
    websiteUri?: string;
  }
): GbpAttributeCoverage {
  const active = available.filter((meta) => !meta.deprecated);
  const enabledKeys = new Set(
    current.filter(isEnabledGbpAttribute).map((attribute) => attributeKey(attribute.name))
  );

  const enabled = active
    .filter((meta) => enabledKeys.has(attributeKey(meta.name)))
    .map((meta) => ({
      name: meta.name,
      displayName: meta.displayName,
      groupDisplayName: meta.groupDisplayName,
      valueType: meta.valueType,
      autoApplicable: false,
    }));

  const missingKeys = new Set(
    active
      .filter((meta) => !enabledKeys.has(attributeKey(meta.name)))
      .map((meta) => attributeKey(meta.name))
  );

  const missing = sortByPriority(active, missingKeys).map((meta) => {
    const autoUpdate = buildAutoUpdate(meta, options?.websiteUri);
    return {
      name: meta.name,
      displayName: meta.displayName,
      groupDisplayName: meta.groupDisplayName,
      valueType: meta.valueType,
      autoApplicable: autoUpdate != null,
    };
  });

  const autoUpdates = sortByPriority(active, missingKeys)
    .map((meta) => buildAutoUpdate(meta, options?.websiteUri))
    .filter((update): update is GbpAttributeUpdate => update != null);

  return {
    enabledCount: enabled.length,
    availableCount: active.length,
    missingCount: missing.length,
    enabled,
    missing,
    autoUpdates,
  };
}

export function chunkAttributeUpdates(updates: GbpAttributeUpdate[]): GbpAttributeUpdate[][] {
  const batches: GbpAttributeUpdate[][] = [];
  for (let i = 0; i < updates.length; i += ATTRIBUTE_BATCH_SIZE) {
    batches.push(updates.slice(i, i + ATTRIBUTE_BATCH_SIZE));
  }
  return batches;
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
  return buildAttributeCoverage(available, current, options).autoUpdates.slice(0, limit);
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
  return buildAttributeCoverage(available, current).missingCount;
}

export function attributeDisplayName(
  coverage: GbpAttributeCoverage,
  attributeName: string
): string {
  const match =
    coverage.missing.find((item) => item.name === attributeName) ??
    coverage.enabled.find((item) => item.name === attributeName);
  return match?.displayName ?? attributeName;
}
