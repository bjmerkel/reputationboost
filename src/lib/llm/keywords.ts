import { completeJson } from "./client";
import { isLlmConfigured } from "./config";

export interface KeywordSuggestion {
  keyword: string;
  reason: string;
}

export interface SuggestKeywordsInput {
  name: string;
  industry: string;
  city: string;
  state: string;
  address?: string;
  website?: string;
  /** Current tracked keywords (portfolio mode). */
  existingKeywords?: string[];
  /** When set, suggest replacements for this one keyword. */
  replaceKeyword?: string;
  /** High-signal GBP search terms to prefer. */
  gbpSearchTerms?: string[];
}

export interface SuggestKeywordsResult {
  keywords: KeywordSuggestion[];
  source: "llm" | "template";
  llmConfigured: boolean;
  warning?: string;
}

interface LlmKeywordResponse {
  keywords: KeywordSuggestion[];
}

const KEYWORD_SYSTEM = `You are a local SEO expert specializing in Google Maps and Local 3-Pack rankings.

Your ONLY job is to suggest HIGH-VOLUME keywords that real customers type into Google Maps / Google local search when looking for this type of business.

Infer volume from how people actually search Maps — not from blog SEO long-tails. Prefer short, common, category-level queries over niche phrases.

Return valid JSON only.`;

/** Patterns that look like low-volume research / blog SEO, not Maps pack queries. */
const LOW_VOLUME_RE =
  /\b(cost|costs|price|prices|pricing|quote|quotes|estimate|estimates|how much|how to|diy|vs|versus|review|reviews|salary|jobs|hiring|career|careers|what is|why|when to|pros|experts|tips|guide|checklist|comparison)\b/i;

const STREET_ADDRESS_RE =
  /\b\d{1,6}\s+\w+.*\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl)\b/i;

const FILLER_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "in",
  "of",
  "to",
  "with",
]);

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function industryShort(industry: string): string {
  return industry
    .toLowerCase()
    .replace(/\b(contractor|company|service|services|inc|llc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");
}

/**
 * Heuristic: keep only keywords that look like high-volume Google Maps queries.
 * Google does not expose search volume; we infer from phrasing patterns that
 * dominate Local Pack / Maps demand (service+geo, near me, core category).
 */
export function isHighVolumeMapsKeyword(
  keyword: string,
  input: Pick<SuggestKeywordsInput, "name" | "industry" | "city" | "state">
): boolean {
  const term = normalizeKeyword(keyword);
  if (!term || term.length < 3) return false;
  if (STREET_ADDRESS_RE.test(term)) return false;
  if (LOW_VOLUME_RE.test(term)) return false;
  if (/[–—]|https?:\/\//.test(term)) return false;
  if (/["']/.test(term)) return false;

  const words = term.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;

  const contentWords = words.filter((w) => !FILLER_WORDS.has(w));
  if (contentWords.length < 2) return false;

  const city = input.city?.trim().toLowerCase() ?? "";
  const state = input.state?.trim().toLowerCase() ?? "";
  const nameTokens = normalizeKeyword(input.name)
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !FILLER_WORDS.has(t));

  // City-only / brand-only navigational queries are not rank keywords.
  if (city && (term === city || term === `${city} ${state}`.trim())) return false;
  if (nameTokens.length > 0 && nameTokens.every((t) => term.includes(t)) && !hasServiceSignal(term, input.industry)) {
    return false;
  }

  // Must look like a Maps find-a-business query: service signal and/or near me + geo.
  const hasNearMe = /\bnear me\b/.test(term);
  const hasGeo =
    (city.length >= 3 && term.includes(city)) ||
    (state.length === 2 && new RegExp(`\\b${state}\\b`, "i").test(term)) ||
    hasNearMe;

  if (!hasServiceSignal(term, input.industry)) return false;
  if (!hasGeo && !hasNearMe) return false;

  // Ultra-long research phrases rarely win Maps volume.
  if (words.length >= 5 && !hasNearMe) return false;

  return true;
}

function hasServiceSignal(term: string, industry: string): boolean {
  const short = industryShort(industry);
  const industryTokens = short
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .concat(
      industry
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 4 && !FILLER_WORDS.has(t) && !["contractor", "company", "service", "services"].includes(t))
    );

  if (industryTokens.some((t) => term.includes(t))) return true;

  // Common Maps service verbs / categories when industry tokens are sparse.
  return /\b(repair|installation|install|service|services|contractor|plumber|plumbing|hvac|dentist|dental|lawyer|attorney|roofer|roofing|electrician|locksmith|chiropractor|restaurant|pizza|salon|barber|gym|daycare|preschool|cleaning|mover|movers|towing|mechanic|dentist|orthodontist|veterinarian|vet|clinic|urgent care)\b/i.test(
    term
  );
}

function templateKeywords(input: SuggestKeywordsInput): KeywordSuggestion[] {
  const { industry, city, state } = input;
  const short = industryShort(industry) || industry.toLowerCase();
  const cityState = city && state ? `${city} ${state}` : city || state || "";

  const candidates: KeywordSuggestion[] = [
    {
      keyword: `${short} ${city}`.trim(),
      reason: "Core high-volume Maps query — service plus city.",
    },
    {
      keyword: `${short} near me`,
      reason: "Very high-volume mobile Maps query for nearby providers.",
    },
    {
      keyword: `${short} ${cityState}`.trim(),
      reason: "Service + city/state — common Local Pack phrasing.",
    },
    {
      keyword: `best ${short} ${city}`.trim(),
      reason: "High-intent comparison query that still maps to Local Pack.",
    },
    {
      keyword: `emergency ${short} ${city}`.trim(),
      reason: "High-converting urgent Maps search for local service categories.",
    },
    {
      keyword: `${short} repair ${city}`.trim(),
      reason: "Common problem-aware Maps search for local service businesses.",
    },
    {
      keyword: `${short} installation ${city}`.trim(),
      reason: "Common project-intent Maps search for installers.",
    },
  ];

  return candidates
    .map((item) => ({ ...item, keyword: normalizeKeyword(item.keyword) }))
    .filter((item) => isHighVolumeMapsKeyword(item.keyword, input));
}

function portfolioTemplateKeywords(input: SuggestKeywordsInput): KeywordSuggestion[] {
  const replaceLower = input.replaceKeyword ? normalizeKeyword(input.replaceKeyword) : null;
  const blocked = new Set(
    (input.existingKeywords ?? [])
      .map(normalizeKeyword)
      .filter((keyword) => keyword && keyword !== replaceLower)
  );

  const fromGbp = (input.gbpSearchTerms ?? [])
    .map(normalizeKeyword)
    .filter(
      (term) =>
        term.length >= 3 &&
        !blocked.has(term) &&
        term !== replaceLower &&
        isHighVolumeMapsKeyword(term, input)
    )
    .slice(0, 6)
    .map((keyword) => ({
      keyword,
      reason: "Appears in your Google Business Profile search terms — proven Maps demand.",
    }));

  const base = templateKeywords(input).filter(
    (item) => !blocked.has(item.keyword) && item.keyword !== replaceLower
  );

  const merged = [...fromGbp, ...base];
  const seen = new Set<string>();
  const unique: KeywordSuggestion[] = [];
  for (const item of merged) {
    if (seen.has(item.keyword)) continue;
    seen.add(item.keyword);
    unique.push(item);
  }

  // Last-resort high-volume variants so the UI never gets an empty list.
  if (unique.length === 0) {
    const short = industryShort(input.industry) || "local service";
    const city = input.city || "near me";
    for (const pattern of [
      `${short} ${city}`,
      `${short} near me`,
      `best ${short} ${city}`,
      `${short} ${input.state || ""} ${city}`.trim(),
    ]) {
      const keyword = normalizeKeyword(pattern);
      if (!keyword || blocked.has(keyword) || keyword === replaceLower) continue;
      if (!isHighVolumeMapsKeyword(keyword, input)) continue;
      unique.push({
        keyword,
        reason: "High-volume Maps-style fallback for this category and market.",
      });
      if (unique.length >= 4) break;
    }
  }

  return unique.slice(0, input.replaceKeyword ? 6 : 8);
}

function sanitizeSuggestions(
  items: KeywordSuggestion[],
  input: SuggestKeywordsInput
): KeywordSuggestion[] {
  const replaceLower = input.replaceKeyword ? normalizeKeyword(input.replaceKeyword) : null;
  const blocked = new Set(
    (input.existingKeywords ?? [])
      .map(normalizeKeyword)
      .filter((keyword) => keyword && keyword !== replaceLower)
  );

  const seen = new Set<string>();
  const out: KeywordSuggestion[] = [];
  for (const item of items) {
    const keyword = normalizeKeyword(item.keyword ?? "");
    const reason = item.reason?.trim();
    if (!keyword || keyword.length < 3 || !reason) continue;
    if (keyword === replaceLower) continue;
    if (blocked.has(keyword)) continue;
    if (!isHighVolumeMapsKeyword(keyword, input)) continue;
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    out.push({ keyword, reason });
  }
  return out;
}

export async function suggestKeywords(
  input: SuggestKeywordsInput
): Promise<SuggestKeywordsResult> {
  const isPortfolio = Boolean(input.existingKeywords?.length || input.replaceKeyword);
  const fallback = sanitizeSuggestions(
    isPortfolio ? portfolioTemplateKeywords(input) : templateKeywords(input),
    input
  );
  const llmConfigured = isLlmConfigured();

  if (!llmConfigured) {
    return {
      keywords: fallback.slice(0, isPortfolio ? 6 : 6),
      source: "template",
      llmConfigured: false,
      warning: "OPENAI_API_KEY is not configured — using template suggestions.",
    };
  }

  try {
    const replaceBlock = input.replaceKeyword
      ? `Suggest 4-6 HIGH-VOLUME Google Maps replacements for the tracked keyword "${input.replaceKeyword}". Only suggest queries real customers type into Maps when looking for this business. Each suggestion must be different from the current tracked set.`
      : `Suggest 6-8 HIGH-VOLUME Google Maps keywords for Local 3-Pack rank tracking.`;

    const portfolioBlock = isPortfolio
      ? `
CURRENT TRACKED KEYWORDS:
${JSON.stringify(input.existingKeywords ?? [], null, 2)}

KEYWORD BEING REPLACED (if any):
${JSON.stringify(input.replaceKeyword ?? null)}

GBP SEARCH TERMS (prefer these when they look like high-volume Maps queries):
${JSON.stringify(input.gbpSearchTerms ?? [], null, 2)}

Do not suggest exact duplicates of currently tracked keywords.
`
      : "";

    const llm = await completeJson<LlmKeywordResponse>(
      [
        { role: "system", content: KEYWORD_SYSTEM },
        {
          role: "user",
          content: `${replaceBlock}

BUSINESS:
${JSON.stringify(
  {
    name: input.name,
    industry: input.industry,
    city: input.city,
    state: input.state,
    address: input.address,
    website: input.website,
  },
  null,
  2
)}
${portfolioBlock}
Volume rules (critical — Google does not publish Maps volume; infer it):
- ONLY suggest keywords that would get meaningful Google Maps / Local Pack search volume
- Prefer: service + city, service + "near me", service + city + state, best + service + city
- Prefer short queries (2-4 words). 5 words max, and only if still a common Maps phrase
- Prefer category-level demand over niche long-tails
- DO NOT suggest: cost/price/quote/how-to/DIY/salary/jobs, street addresses, city-only, brand-only, blog SEO phrases
- DO NOT invent ultra-specific problem phrases unlikely to be typed in Maps
- Each keyword: lowercase, no quotes
- reason: one concise sentence explaining why this is a high-volume Maps query for this business

Return JSON:
{
  "keywords": [
    { "keyword": "example keyword", "reason": "why it is high-volume on Maps" }
  ]
}`,
        },
      ],
      { maxTokens: 1200, temperature: 0.35 }
    );

    const keywords = sanitizeSuggestions(llm.keywords ?? [], input).slice(
      0,
      input.replaceKeyword ? 6 : 8
    );

    if (keywords.length === 0) {
      return {
        keywords: fallback.slice(0, 6),
        source: "template",
        llmConfigured: true,
        warning: "AI returned no high-volume Maps keywords — showing template suggestions.",
      };
    }

    // Top up with high-volume templates if the model returned too few.
    if (keywords.length < (input.replaceKeyword ? 2 : 3)) {
      const seen = new Set(keywords.map((item) => item.keyword));
      for (const item of fallback) {
        if (seen.has(item.keyword)) continue;
        keywords.push(item);
        if (keywords.length >= 4) break;
      }
    }

    return { keywords, source: "llm", llmConfigured: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM request failed";
    console.error("[llm] keyword suggestion failed, using templates:", error);
    return {
      keywords: fallback.slice(0, 6),
      source: "template",
      llmConfigured: true,
      warning: `AI suggestion failed (${message}) — using template suggestions.`,
    };
  }
}
