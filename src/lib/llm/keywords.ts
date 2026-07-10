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
Suggest keywords real customers type into Google Maps when looking for this business.
Focus on local intent: city names, "near me", service-specific terms, and problem-aware searches.
Return valid JSON only.`;

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

function templateKeywords(input: SuggestKeywordsInput): KeywordSuggestion[] {
  const { industry, city, state } = input;
  const short = industryShort(industry) || industry.toLowerCase();
  const cityState = city && state ? `${city} ${state}` : city || state || "local area";

  return [
    {
      keyword: `${short} ${city}`.trim(),
      reason: "Core local search — service plus city where customers look on Google Maps.",
    },
    {
      keyword: `${short} near me`,
      reason: "High-volume mobile Maps query when searchers want the closest provider.",
    },
    {
      keyword: `best ${short} ${city}`.trim(),
      reason: "Comparison intent — searchers evaluating top-rated businesses in the area.",
    },
    {
      keyword: `${short} ${cityState}`.trim(),
      reason: "Broader geo match for users who include state in their search.",
    },
    {
      keyword: `emergency ${short} ${city}`.trim(),
      reason: "Urgent-intent variant if applicable — captures high-converting searches.",
    },
    {
      keyword: `${short} repair ${city}`.trim(),
      reason: "Problem-aware local query common in Maps and Local Pack results.",
    },
    {
      keyword: `${short} installation ${city}`.trim(),
      reason: "Project-intent search that often converts for local service businesses.",
    },
    {
      keyword: `${short} services ${city}`.trim(),
      reason: "Service-category phrasing common in Local Pack results.",
    },
  ]
    .map((item) => ({ ...item, keyword: normalizeKeyword(item.keyword) }))
    .filter((k) => k.keyword.length > 3);
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
    .filter((term) => term.length >= 3 && !blocked.has(term) && term !== replaceLower)
    .slice(0, 6)
    .map((keyword) => ({
      keyword,
      reason: "Appears in your Google Business Profile search terms.",
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

  // Last-resort unique variants so the UI never gets an empty list.
  if (unique.length === 0) {
    const short = industryShort(input.industry) || "local service";
    const city = input.city || "near me";
    for (const suffix of ["quotes", "cost", "company", "pros", "experts"]) {
      const keyword = normalizeKeyword(`${short} ${suffix} ${city}`);
      if (blocked.has(keyword) || keyword === replaceLower) continue;
      unique.push({
        keyword,
        reason: "Fallback local-intent variant to keep your portfolio moving.",
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
      ? `Suggest 4-6 replacements for the tracked keyword "${input.replaceKeyword}". Prefer demand-backed local service queries over city-only or street-address terms. Each suggestion must be different from the current tracked set.`
      : `Suggest 6-8 target keywords for Local 3-Pack rank tracking.`;

    const portfolioBlock = isPortfolio
      ? `
CURRENT TRACKED KEYWORDS:
${JSON.stringify(input.existingKeywords ?? [], null, 2)}

KEYWORD BEING REPLACED (if any):
${JSON.stringify(input.replaceKeyword ?? null)}

GBP SEARCH TERMS (prefer these when relevant):
${JSON.stringify(input.gbpSearchTerms ?? [], null, 2)}

Do not suggest exact duplicates of currently tracked keywords.
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

    const keywords = sanitizeSuggestions(llm.keywords ?? [], input).slice(
      0,
      input.replaceKeyword ? 6 : 8
    );

    if (keywords.length === 0) {
      return {
        keywords: fallback.slice(0, 6),
        source: "template",
        llmConfigured: true,
        warning: "AI returned no usable keywords — showing template suggestions.",
      };
    }

    // Top up with templates if the model returned too few.
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
