import type {
  GbpAttributeCoverage,
  GbpAttributeCoverageItem,
  GbpConfiguredProfileLink,
} from "@/audit/types";
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

const PROFILE_LINK_PLATFORM_KEYWORDS = [
  "facebook",
  "instagram",
  "linkedin",
  "pinterest",
  "tiktok",
  "whatsapp",
  "twitter",
  "youtube",
  "texting",
];

const SUPPLEMENTAL_PROFILE_LINK_ATTRIBUTES: Array<
  Pick<GbpAttributeMetadata, "name" | "displayName" | "groupDisplayName" | "valueType">
> = [
  {
    name: "attributes/url_facebook",
    displayName: "Facebook",
    groupDisplayName: "Place page URLs",
    valueType: "URL",
  },
  {
    name: "attributes/url_instagram",
    displayName: "Instagram",
    groupDisplayName: "Place page URLs",
    valueType: "URL",
  },
];

function profileLinkHaystack(
  meta: Pick<GbpAttributeMetadata, "displayName" | "groupDisplayName" | "name">
): string {
  return `${meta.displayName} ${meta.groupDisplayName} ${meta.name}`.toLowerCase();
}

export function isProfileLinkAttribute(
  meta: Pick<GbpAttributeMetadata, "displayName" | "groupDisplayName" | "name" | "valueType">
): boolean {
  if (!isUriAttributeType(meta.valueType)) return false;

  const haystack = profileLinkHaystack(meta);
  if (haystack.includes("place page url")) return true;

  if (
    haystack.includes("appointment") ||
    haystack.includes("booking") ||
    haystack.includes("menu") ||
    haystack.includes("reserv")
  ) {
    return false;
  }

  return PROFILE_LINK_PLATFORM_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function isProfileLinkCoverageItem(
  item: Pick<GbpAttributeCoverageItem, "displayName" | "groupDisplayName" | "name" | "valueType">
): boolean {
  return isProfileLinkAttribute(item);
}

function attributeUriValue(attr: GbpLocationAttribute): string | undefined {
  return attr.values.find(
    (value) =>
      value.startsWith("https://") ||
      value.startsWith("http://") ||
      value.startsWith("sms:") ||
      value.startsWith("tel:")
  );
}

function profileLinkDisplayName(
  attr: GbpLocationAttribute,
  meta?: GbpAttributeMetadata
): string {
  if (meta?.displayName) return meta.displayName;
  const haystack = `${attr.name}`.toLowerCase();
  if (haystack.includes("facebook")) return "Facebook";
  if (haystack.includes("instagram")) return "Instagram";
  if (haystack.includes("linkedin")) return "LinkedIn";
  if (haystack.includes("pinterest")) return "Pinterest";
  if (haystack.includes("tiktok")) return "TikTok";
  if (haystack.includes("whatsapp")) return "WhatsApp";
  if (haystack.includes("twitter")) return "X (Twitter)";
  if (haystack.includes("youtube")) return "YouTube";
  if (haystack.includes("text")) return "Texting number";
  return attr.name.replace(/^attributes\//, "").replace(/_/g, " ");
}

/** Profile-link URIs already set on the GBP location (from getAttributes). */
export function buildConfiguredProfileLinks(
  current: GbpLocationAttribute[],
  available: GbpAttributeMetadata[]
): GbpConfiguredProfileLink[] {
  const metadataByKey = new Map<string, GbpAttributeMetadata>();
  for (const meta of available) {
    metadataByKey.set(attributeKey(meta.name), meta);
    metadataByKey.set(meta.name, meta);
  }

  const links: GbpConfiguredProfileLink[] = [];
  const seenPlatforms = new Set<string>();

  for (const attr of current) {
    if (!isEnabledGbpAttribute(attr)) continue;
    const uri = attributeUriValue(attr);
    if (!uri) continue;

    const meta = metadataByKey.get(attributeKey(attr.name)) ?? metadataByKey.get(attr.name);
    const item = {
      name: attr.name,
      displayName: profileLinkDisplayName(attr, meta),
      groupDisplayName: meta?.groupDisplayName ?? "Place page URLs",
      valueType: meta?.valueType ?? attr.valueType ?? "URL",
    };

    if (!isProfileLinkAttribute(item)) continue;

    const platform = profilePlatformKey(item);
    if (platform) {
      if (seenPlatforms.has(platform)) continue;
      seenPlatforms.add(platform);
    }

    links.push({
      name: attr.name,
      displayName: item.displayName,
      groupDisplayName: item.groupDisplayName,
      valueType: item.valueType,
      uri,
      platform: platform ?? undefined,
    });
  }

  return links.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildMissingProfileLinkItems(
  active: GbpAttributeMetadata[],
  configuredProfileLinks: GbpConfiguredProfileLink[]
): GbpAttributeCoverageItem[] {
  const configuredKeys = new Set(
    configuredProfileLinks.map((item) => attributeKey(item.name))
  );
  const configuredPlatforms = new Set(
    configuredProfileLinks
      .map((item) => item.platform ?? profilePlatformKey(item))
      .filter((platform): platform is string => Boolean(platform))
  );
  const seen = new Set<string>();
  const items: GbpAttributeCoverageItem[] = [];

  const add = (item: GbpAttributeCoverageItem) => {
    const key = attributeKey(item.name);
    if (configuredKeys.has(key) || seen.has(key)) return;

    const platform = profilePlatformKey(item);
    if (platform && configuredPlatforms.has(platform)) return;

    seen.add(key);
    items.push(item);
  };

  for (const meta of active) {
    if (!isProfileLinkAttribute(meta)) continue;
    add({
      name: meta.name,
      displayName: meta.displayName,
      groupDisplayName: meta.groupDisplayName,
      valueType: meta.valueType,
      autoApplicable: false,
    });
  }

  for (const supplemental of SUPPLEMENTAL_PROFILE_LINK_ATTRIBUTES) {
    const platform = supplemental.displayName.toLowerCase();
    const alreadyRepresented = active.some(
      (meta) => isProfileLinkAttribute(meta) && profileLinkHaystack(meta).includes(platform)
    );
    if (alreadyRepresented) continue;

    add({
      name: supplemental.name,
      displayName: supplemental.displayName,
      groupDisplayName: supplemental.groupDisplayName,
      valueType: supplemental.valueType,
      autoApplicable: false,
    });
  }

  return items.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function matchesHighValue(meta: GbpAttributeMetadata): boolean {
  const haystack = `${meta.displayName} ${meta.groupDisplayName} ${meta.name}`.toLowerCase();
  return HIGH_VALUE_KEYWORDS.some((kw) => haystack.includes(kw));
}

export function isUriAttributeType(valueType: string): boolean {
  const type = valueType.toUpperCase();
  return type.includes("URI") || type === "URL";
}

function isUriAttribute(meta: GbpAttributeMetadata): boolean {
  return isUriAttributeType(meta.valueType);
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

  const configuredProfileLinks = buildConfiguredProfileLinks(current, active);

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

  const profileLinkMissing = buildMissingProfileLinkItems(active, configuredProfileLinks);

  return {
    enabledCount: enabled.length,
    availableCount: active.length,
    missingCount: missing.length,
    enabled,
    missing,
    profileLinkMissing,
    configuredProfileLinks,
    supportedAttributeNames: active.map((meta) => meta.name),
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
    coverage.profileLinkMissing?.find((item) => item.name === attributeName) ??
    coverage.missing.find((item) => item.name === attributeName) ??
    coverage.enabled.find((item) => item.name === attributeName);
  return match?.displayName ?? attributeName;
}

function profilePlatformKey(
  item: Pick<GbpAttributeCoverageItem, "displayName" | "name">
): string | null {
  const haystack = profileLinkHaystack(item);
  for (const platform of PROFILE_LINK_PLATFORM_KEYWORDS) {
    if (haystack.includes(platform)) return platform;
  }
  return null;
}

/** Live profile-link gaps, including Facebook/Instagram even on older audits. */
export function resolveProfileLinkMissing(
  coverage?: GbpAttributeCoverage
): GbpAttributeCoverageItem[] {
  if (!coverage) return [];

  const configuredKeys = new Set(
    (coverage.configuredProfileLinks ?? []).map((item) => attributeKey(item.name))
  );
  const configuredPlatforms = new Set(
    (coverage.configuredProfileLinks ?? [])
      .map((item) => item.platform ?? profilePlatformKey(item))
      .filter((platform): platform is string => Boolean(platform))
  );
  const enabledKeys = new Set(coverage.enabled.map((item) => attributeKey(item.name)));
  const seenKeys = new Set<string>();
  const seenPlatforms = new Set<string>();
  const items: GbpAttributeCoverageItem[] = [];

  const add = (item: GbpAttributeCoverageItem) => {
    const key = attributeKey(item.name);
    if (configuredKeys.has(key) || enabledKeys.has(key) || seenKeys.has(key)) return;

    const platform = profilePlatformKey(item);
    if (platform) {
      if (configuredPlatforms.has(platform) || seenPlatforms.has(platform)) return;
      seenPlatforms.add(platform);
    }

    seenKeys.add(key);
    items.push(item);
  };

  for (const item of coverage.profileLinkMissing ?? []) add(item);
  for (const item of coverage.missing) {
    if (isProfileLinkCoverageItem(item)) add(item);
  }
  for (const supplemental of SUPPLEMENTAL_PROFILE_LINK_ATTRIBUTES) {
    add({
      name: supplemental.name,
      displayName: supplemental.displayName,
      groupDisplayName: supplemental.groupDisplayName,
      valueType: supplemental.valueType,
      autoApplicable: false,
    });
  }

  return items.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function digitsOnlyPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Best-effort URL for URI attributes the user still needs to provide. */
export function suggestUriForAttribute(
  meta: Pick<GbpAttributeMetadata, "displayName" | "name">,
  options?: {
    websiteUri?: string;
    phone?: string;
  }
): string {
  const haystack = `${meta.displayName} ${meta.name}`.toLowerCase();
  const phoneDigits = options?.phone ? digitsOnlyPhone(options.phone) : "";

  if (phoneDigits) {
    if (haystack.includes("whatsapp")) {
      return `https://wa.me/${phoneDigits}`;
    }
    if (haystack.includes("text")) {
      return `sms:+${phoneDigits}`;
    }
  }

  if (haystack.includes("facebook")) {
    return "https://www.facebook.com/";
  }
  if (haystack.includes("instagram")) {
    return "https://www.instagram.com/";
  }

  return "";
}

/** Placeholder hint for profile-link URL inputs. */
export function profileLinkUriPlaceholder(
  meta: Pick<GbpAttributeMetadata, "displayName" | "name">
): string {
  const haystack = `${meta.displayName} ${meta.name}`.toLowerCase();
  if (haystack.includes("facebook")) return "https://www.facebook.com/your-page";
  if (haystack.includes("instagram")) return "https://www.instagram.com/your-handle";
  if (haystack.includes("linkedin")) return "https://www.linkedin.com/company/your-page";
  if (haystack.includes("pinterest")) return "https://www.pinterest.com/your-page";
  if (haystack.includes("tiktok")) return "https://www.tiktok.com/@your-handle";
  if (haystack.includes("whatsapp")) return "https://wa.me/15551234567";
  if (haystack.includes("twitter") || haystack.includes("_x")) {
    return "https://www.twitter.com/your-handle";
  }
  if (haystack.includes("youtube")) return "https://www.youtube.com/@your-channel";
  if (haystack.includes("text")) return "sms:+15551234567";
  return "https://";
}

/** URI attributes that can be published once the user supplies a link. */
export function buildUserUriAttributeUpdates(
  missing: Array<Pick<GbpAttributeMetadata, "name" | "displayName" | "valueType">>,
  options?: {
    websiteUri?: string;
    phone?: string;
  }
): GbpAttributeUpdate[] {
  return missing
    .filter((item) => isUriAttributeType(item.valueType))
    .map((item) => ({
      name: item.name,
      uri: suggestUriForAttribute(item, options),
    }));
}
