import type { Phase1AuditPayload } from "@/audit/types";
import { sanitizeServiceText, FREE_FORM_DESCRIPTION_MAX_LENGTH } from "./gbp-service-items";

/** Generic words that should not count as keyword coverage in service names. */
const SERVICE_KEYWORD_STOPWORDS = new Set([
  "near",
  "local",
  "best",
  "top",
  "cheap",
  "affordable",
  "professional",
  "quality",
  "trusted",
  "service",
  "services",
  "company",
  "business",
  "center",
  "centre",
  "area",
  "areas",
  "vegas",
  "dallas",
  "houston",
  "austin",
  "texas",
  "nevada",
  "california",
  "florida",
  "nearby",
  "around",
  "las",
]);

function cityFromAddress(address: string): string {
  const parts = address.split(",");
  return parts.length > 1 ? parts[parts.length - 2]?.trim() ?? "your area" : "your area";
}

function significantKeywordTokens(keyword: string, extraStopwords: string[] = []): string[] {
  const stop = new Set([...SERVICE_KEYWORD_STOPWORDS, ...extraStopwords.map((w) => w.toLowerCase())]);
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9'-]/g, ""))
    .filter((w) => w.length > 3 && !stop.has(w));
}

/** Whether a service name covers a target keyword (ignores generic/geo tokens). */
export function serviceCoversKeyword(serviceName: string, keyword: string, extraStopwords: string[] = []): boolean {
  const tokens = significantKeywordTokens(keyword, extraStopwords);
  if (tokens.length === 0) {
    const normalized = keyword.toLowerCase().trim();
    return normalized.length > 0 && serviceName.toLowerCase().includes(normalized);
  }
  const haystack = serviceName.toLowerCase();
  return tokens.some((token) => {
    const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    return pattern.test(haystack);
  });
}

/** Whether any listed service covers the keyword. */
export function keywordCoveredByServices(
  serviceNames: string[],
  keyword: string,
  extraStopwords: string[] = []
): boolean {
  return serviceNames.some((name) => serviceCoversKeyword(name, keyword, extraStopwords));
}

/** Keywords that lack a dedicated GBP service name. */
export function missingServiceKeywords(
  keywords: string[],
  serviceNames: string[],
  extraStopwords: string[] = []
): string[] {
  return keywords.filter(
    (kw) => !keywordCoveredByServices(serviceNames, kw, extraStopwords)
  );
}

function titleCaseWords(words: string[]): string {
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Turn a ranking keyword into a GBP service display name. */
export function keywordToServiceName(keyword: string, audit?: Pick<Phase1AuditPayload, "clientName" | "gbp">): string {
  const businessTokens = new Set(
    (audit?.clientName ?? "")
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length > 2)
  );
  const city = audit?.gbp.identity.address ? cityFromAddress(audit.gbp.identity.address).toLowerCase() : "";
  const extraStop = city ? [city] : [];

  const tokens = keyword
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9'-]/g, ""))
    .filter(
      (w) =>
        w.length > 2 &&
        !SERVICE_KEYWORD_STOPWORDS.has(w) &&
        !extraStop.includes(w) &&
        !businessTokens.has(w)
    );

  if (tokens.length === 0) {
    return titleCaseWords(keyword.split(/\s+/).filter((w) => w.length > 2).slice(0, 4));
  }

  const name = titleCaseWords(tokens.slice(0, 5));
  if (
    !/\bservices?\b/i.test(name) &&
    /\b(service|repair|program|tutoring|assistance|care|cleaning|plumb)\b/i.test(keyword)
  ) {
    return `${name} Services`;
  }
  return name;
}

function descriptionForKeyword(keyword: string, audit: Pick<Phase1AuditPayload, "clientName" | "gbp">): string {
  const city = cityFromAddress(audit.gbp.identity.address);
  const name = audit.clientName;
  const lower = keyword.toLowerCase();

  if (/\btutor/i.test(lower)) {
    return `Personalized tutoring sessions designed to enhance children's academic skills through tailored learning experiences at ${name} in ${city}.`;
  }
  if (/\benrichment|after[\s-]?school|program/i.test(lower)) {
    return `Engaging enrichment programs that foster creativity and learning through arts, sports, and educational activities for ${city} families at ${name}.`;
  }
  if (/\blearning center|daycare|preschool|child care/i.test(lower)) {
    return `${name} provides a nurturing learning environment in ${city} with experienced educators, structured curriculum, and activities that support each child's growth.`;
  }
  if (/\bhomework|study/i.test(lower)) {
    return `Structured homework support and study skills coaching that helps students build confidence, stay on track, and succeed academically at ${name}.`;
  }

  const serviceLabel = keywordToServiceName(keyword, audit);
  return `${name} offers ${serviceLabel.toLowerCase()} for customers in ${city} and surrounding areas, with experienced staff and a focus on quality, safety, and results.`;
}

/** Publish-ready service description for a target keyword. */
export function generateServiceDescription(
  keyword: string,
  audit: Pick<Phase1AuditPayload, "clientName" | "gbp">
): string {
  return sanitizeServiceText(descriptionForKeyword(keyword, audit), FREE_FORM_DESCRIPTION_MAX_LENGTH);
}

export interface ServicePlanBlock {
  label: string;
  content: string;
  serviceName: string;
  keyword: string;
}

/** Plan copy blocks for step 4 — one per uncovered keyword. */
export function buildServicePlanBlocks(audit: Phase1AuditPayload): ServicePlanBlock[] {
  const keywords = audit.rankings.keywords.map((k) => k.keyword);
  const serviceNames = (audit.gbp.liveProfile?.services ?? []).map((s) => s.name);
  const cityTokens = cityFromAddress(audit.gbp.identity.address)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const missing = missingServiceKeywords(keywords, serviceNames, cityTokens);
  const toAdd = missing.length > 0 ? missing : keywords;

  const seenNames = new Set(serviceNames.map((n) => n.toLowerCase()));

  return toAdd
    .map((keyword, i) => {
      const serviceName = keywordToServiceName(keyword, audit);
      return {
        label: `Service #${i + 1}: ${serviceName}`,
        content: generateServiceDescription(keyword, audit),
        serviceName,
        keyword,
      };
    })
    .filter((block) => {
      const key = block.serviceName.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
}
