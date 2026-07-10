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

interface LlmKeywordResponse {
  keywords: KeywordSuggestion[];
}

const KEYWORD_SYSTEM = `You are a local SEO expert specializing in Google Maps and Local 3-Pack rankings.
Suggest keywords real customers type into Google Maps when looking for this business.
Focus on local intent: city names, "near me", service-specific terms, and problem-aware searches.
Return valid JSON only.`;

function templateKeywords(input: SuggestKeywordsInput): KeywordSuggestion[] {
  const { industry, city, state } = input;
  const cityState = city && state ? `${city} ${state}` : city || state || "local area";

  return [
    {
      keyword: `${industry} ${city}`.trim(),
      reason: "Core local search — service plus city where customers look on Google Maps.",
    },
    {
      keyword: `${industry} near me`,
      reason: "High-volume mobile Maps query when searchers want the closest provider.",
    },
    {
      keyword: `best ${industry} ${city}`.trim(),
      reason: "Comparison intent — searchers evaluating top-rated businesses in the area.",
    },
    {
      keyword: `${industry} ${cityState}`.trim(),
      reason: "Broader geo match for users who include state in their search.",
    },
    {
      keyword: `emergency ${industry} ${city}`.trim(),
      reason: "Urgent-intent variant if applicable — captures high-converting searches.",
    },
    {
      keyword: `${industry} services ${city}`.trim(),
      reason: "Service-category phrasing common in Local Pack results.",
    },
  ].filter((k) => k.keyword.length > 3);
}

function portfolioTemplateKeywords(input: SuggestKeywordsInput): KeywordSuggestion[] {
  const existing = new Set((input.existingKeywords ?? []).map((k) => k.toLowerCase()));
  const fromGbp = (input.gbpSearchTerms ?? [])
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 3 && !existing.has(term))
    .slice(0, 4)
    .map((keyword) => ({
      keyword,
      reason: "Appears in your Google Business Profile search terms.",
    }));

  const base = templateKeywords(input).filter((item) => !existing.has(item.keyword.toLowerCase()));
  if (input.replaceKeyword) {
    return [...fromGbp, ...base].slice(0, 6);
  }
  return [...fromGbp, ...base].slice(0, 8);
}

export async function suggestKeywords(
  input: SuggestKeywordsInput
): Promise<{ keywords: KeywordSuggestion[]; source: "llm" | "template" }> {
  const isPortfolio = Boolean(input.existingKeywords?.length || input.replaceKeyword);
  const fallback = isPortfolio ? portfolioTemplateKeywords(input) : templateKeywords(input);

  if (!isLlmConfigured()) {
    return { keywords: fallback.slice(0, isPortfolio ? 6 : 6), source: "template" };
  }

  try {
    const replaceBlock = input.replaceKeyword
      ? `Suggest 4-6 replacements for the tracked keyword "${input.replaceKeyword}". Prefer demand-backed local service queries over city-only or street-address terms.`
      : `Suggest 6-8 target keywords for Local 3-Pack rank tracking.`;

    const portfolioBlock = isPortfolio
      ? `
CURRENT TRACKED KEYWORDS:
${JSON.stringify(input.existingKeywords ?? [], null, 2)}

GBP SEARCH TERMS (prefer these when relevant):
${JSON.stringify(input.gbpSearchTerms ?? [], null, 2)}

Do not suggest exact duplicates of currently tracked keywords unless replacing one.
Avoid city-only navigational queries and street addresses.
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
Rules:
- Mix branded, service+city, "near me", and problem/solution queries
- Each keyword should be 2-5 words, lowercase, no quotes
- reason: one concise sentence explaining why this keyword matters for Maps visibility
- Prioritize keywords this specific business could realistically rank for

Return JSON:
{
  "keywords": [
    { "keyword": "example keyword", "reason": "why it matters" }
  ]
}`,
        },
      ],
      { maxTokens: 1200, temperature: 0.5 }
    );

    const existing = new Set((input.existingKeywords ?? []).map((k) => k.toLowerCase()));
    const replaceLower = input.replaceKeyword?.trim().toLowerCase();

    const keywords = (llm.keywords ?? [])
      .filter((k) => k.keyword?.trim() && k.reason?.trim())
      .map((k) => ({
        keyword: k.keyword.trim().toLowerCase(),
        reason: k.reason.trim(),
      }))
      .filter((k) => {
        if (replaceLower && k.keyword === replaceLower) return false;
        if (!replaceLower && existing.has(k.keyword)) return false;
        return true;
      })
      .slice(0, replaceLower ? 6 : 8);

    if (keywords.length < (replaceLower ? 2 : 3)) {
      return { keywords: fallback.slice(0, 6), source: "template" };
    }

    return { keywords, source: "llm" };
  } catch (error) {
    console.error("[llm] keyword suggestion failed, using templates:", error);
    return { keywords: fallback.slice(0, 6), source: "template" };
  }
}
