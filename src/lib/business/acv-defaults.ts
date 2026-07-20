import type { FullAuditPayload } from "@/audit/types";

export function parseLocationFromAddress(address: string): { city: string; state: string } {
  const addressParts = address.split(",").map((part) => part.trim());
  const city = addressParts[1] ?? "";
  const state = addressParts[2]?.split(/\s+/)[0] ?? "";
  return { city, state };
}

export interface AcvDefaultInput {
  businessName?: string | null;
  primaryCategory?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  keywords?: string[] | null;
}

interface AcvTier {
  pattern: RegExp;
  baseValue: number;
}

/**
 * Ordered category tiers — first match wins. Patterns run against a combined
 * signal string built from name, category, industry, and tracked keywords.
 */
const ACV_TIERS: AcvTier[] = [
  // High-ticket professional & specialty trades
  { pattern: /orthodont|oral surgeon|implant dentist/, baseValue: 4800 },
  { pattern: /roof|roofing/, baseValue: 7800 },
  { pattern: /remodel|renovation|kitchen\b|bathroom remodel/, baseValue: 10500 },
  { pattern: /lawyer|attorney|legal|law firm/, baseValue: 1650 },
  { pattern: /real estate|realtor|property management/, baseValue: 5200 },
  { pattern: /auto body|collision repair/, baseValue: 3200 },
  { pattern: /dealer|auto sales|car lot|used car/, baseValue: 3600 },

  // Medical & wellness
  { pattern: /cosmetic surg|med spa|plastic surg/, baseValue: 2200 },
  { pattern: /dentist|dental/, baseValue: 525 },
  { pattern: /chiropr|physio|physical therap/, baseValue: 165 },
  { pattern: /dermatolog|skin care clinic/, baseValue: 425 },
  { pattern: /vet|veterinar|animal hospital/, baseValue: 310 },
  { pattern: /doctor|clinic|medical|urgent care|primary care/, baseValue: 265 },

  // Home & property services
  { pattern: /pool|swimming pool/, baseValue: 725 },
  { pattern: /hvac|heating|cooling|air condition/, baseValue: 625 },
  { pattern: /garage door/, baseValue: 525 },
  { pattern: /window.*(install|replace)|siding|fence company/, baseValue: 3200 },
  { pattern: /plumb/, baseValue: 460 },
  { pattern: /electric/, baseValue: 410 },
  { pattern: /septic|drain|sewer/, baseValue: 525 },
  { pattern: /tree service|arborist|stump/, baseValue: 625 },
  { pattern: /pest|exterminator|termite/, baseValue: 265 },
  { pattern: /landscap|lawn care|irrigation|hardscape/, baseValue: 315 },
  { pattern: /paint|flooring|carpet|tile install/, baseValue: 1750 },
  { pattern: /appliance repair/, baseValue: 265 },
  { pattern: /junk removal|dumpster/, baseValue: 360 },
  { pattern: /moving company|\bmover\b/, baseValue: 925 },
  { pattern: /clean(ing)? service|maid|janitorial|housekeep/, baseValue: 185 },
  { pattern: /handyman/, baseValue: 340 },
  { pattern: /contractor|home improvement/, baseValue: 950 },
  { pattern: /repair|maintenance/, baseValue: 475 },

  // Automotive
  { pattern: /tire|brake|transmission/, baseValue: 440 },
  { pattern: /mechanic|auto repair/, baseValue: 365 },

  // Personal care & pets
  { pattern: /dog groom|pet groom|kennel|boarding/, baseValue: 72 },
  { pattern: /hair salon|barber|nail salon|nail spa/, baseValue: 88 },
  { pattern: /spa\b|massage|esthetician/, baseValue: 115 },

  // Food & hospitality
  { pattern: /cater/, baseValue: 725 },
  { pattern: /restaurant|cafe|bakery|pizza|diner|bistro|food truck/, baseValue: 46 },

  // Retail & goods
  { pattern: /furniture|mattress/, baseValue: 825 },
  { pattern: /jewel/, baseValue: 425 },
  { pattern: /retail|store|shop|boutique|showroom/, baseValue: 82 },

  // Childcare, fitness, events
  { pattern: /daycare|child care|preschool/, baseValue: 1050 },
  { pattern: /gym|fitness|yoga|pilates|crossfit/, baseValue: 120 },
  { pattern: /photograph|wedding plan/, baseValue: 1750 },

  // Catch generic service businesses last
  { pattern: /\bservice/, baseValue: 425 },
];

const DEFAULT_ACV = 400;

const HIGH_COST_STATES = new Set(["CA", "NY", "HI", "MA", "CT", "NJ", "DC"]);
const MID_HIGH_COST_STATES = new Set(["WA", "CO", "MD", "VA", "OR", "IL", "MN"]);
const LOWER_COST_STATES = new Set(["MS", "AL", "AR", "WV", "OK", "LA", "KY"]);

const PREMIUM_METRO_PATTERN =
  /san francisco|oakland|san jose|santa clara|palo alto|mountain view|sunnyvale|cupertino|los angeles|beverly hills|santa monica|manhattan|brooklyn|seattle|boston|washington\b/;

const GENERIC_CATEGORIES = new Set([
  "service",
  "services",
  "local business",
  "business",
  "company",
  "establishment",
]);

function isGenericCategory(value?: string | null): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || GENERIC_CATEGORIES.has(normalized);
}

function combineAcvSignals(input: AcvDefaultInput): string {
  const hasSpecificCategory =
    !isGenericCategory(input.primaryCategory) || !isGenericCategory(input.industry);

  const parts: string[] = [];
  if (input.primaryCategory?.trim()) parts.push(input.primaryCategory.trim());
  if (
    input.industry?.trim() &&
    input.industry.trim().toLowerCase() !== (input.primaryCategory ?? "").trim().toLowerCase()
  ) {
    parts.push(input.industry.trim());
  }
  if (!hasSpecificCategory && input.businessName?.trim()) {
    parts.push(input.businessName.trim());
  }
  if (!hasSpecificCategory && input.keywords?.length) {
    parts.push(...input.keywords.filter((keyword) => keyword.trim()));
  }

  return parts.join(" ").toLowerCase();
}

/** Regional cost-of-living multiplier for ACV template estimates. */
export function regionalAcvMultiplier(
  state?: string | null,
  city?: string | null
): number {
  const normalizedState = (state ?? "").trim().toUpperCase();
  const normalizedCity = (city ?? "").trim().toLowerCase();

  if (!normalizedState) return 1;

  if (HIGH_COST_STATES.has(normalizedState)) {
    if (PREMIUM_METRO_PATTERN.test(normalizedCity)) return 1.2;
    return 1.12;
  }
  if (MID_HIGH_COST_STATES.has(normalizedState)) return 1.06;
  if (LOWER_COST_STATES.has(normalizedState)) return 0.93;
  return 1;
}

/** Round to human-friendly dollar amounts for display defaults. */
export function roundAcvDefault(value: number): number {
  if (value < 100) return Math.round(value / 5) * 5;
  if (value < 500) return Math.round(value / 25) * 25;
  if (value < 2000) return Math.round(value / 50) * 50;
  return Math.round(value / 100) * 100;
}

/** Template ACV from business signals when the owner has not set a value. */
export function estimateTemplateAcv(input: AcvDefaultInput): number {
  const signal = combineAcvSignals(input);
  const multiplier = regionalAcvMultiplier(input.state, input.city);

  if (!signal.trim()) {
    return roundAcvDefault(DEFAULT_ACV * multiplier);
  }

  for (const tier of ACV_TIERS) {
    if (tier.pattern.test(signal)) {
      return roundAcvDefault(tier.baseValue * multiplier);
    }
  }

  return roundAcvDefault(DEFAULT_ACV * multiplier);
}

export function acvDefaultInputFromAudit(
  audit: FullAuditPayload,
  industry?: string | null
): AcvDefaultInput {
  const { city, state } = parseLocationFromAddress(audit.gbp.identity.address);
  return {
    businessName: audit.clientName,
    primaryCategory: audit.gbp.identity.primaryCategory,
    industry: industry ?? audit.gbp.identity.primaryCategory ?? null,
    city,
    state,
    keywords: audit.rankings?.keywords?.map((row) => row.keyword) ?? [],
  };
}

/** Category-default ACV for revenue preview when the user has not set ACV yet. */
export function defaultAcvPreviewHint(audit: FullAuditPayload, industry?: string | null): number {
  return estimateTemplateAcv(acvDefaultInputFromAudit(audit, industry));
}
