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

export async function suggestKeywords(
  input: SuggestKeywordsInput
): Promise<{ keywords: KeywordSuggestion[]; source: "llm" | "template" }> {
  const fallback = templateKeywords(input);

  if (!isLlmConfigured()) {
    return { keywords: fallback.slice(0, 6), source: "template" };
  }

  try {
    const llm = await completeJson<LlmKeywordResponse>(
      [
        { role: "system", content: KEYWORD_SYSTEM },
        {
          role: "user",
          content: `Suggest 6-8 target keywords for Local 3-Pack rank tracking.

BUSINESS:
${JSON.stringify(input, null, 2)}

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

    const keywords = (llm.keywords ?? [])
      .filter((k) => k.keyword?.trim() && k.reason?.trim())
      .slice(0, 8)
      .map((k) => ({
        keyword: k.keyword.trim().toLowerCase(),
        reason: k.reason.trim(),
      }));

    if (keywords.length < 3) {
      return { keywords: fallback.slice(0, 6), source: "template" };
    }

    return { keywords, source: "llm" };
  } catch (error) {
    console.error("[llm] keyword suggestion failed, using templates:", error);
    return { keywords: fallback.slice(0, 6), source: "template" };
  }
}
