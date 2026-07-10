import { completeJson } from "./client";
import { isLlmConfigured } from "./config";

export interface GbpSearchTermInput {
  keyword: string;
  impressions: number | null;
  belowThreshold: boolean;
}

export interface UntrackedGbpOpportunity {
  keyword: string;
  reason: string;
  impressions: number | null;
  belowThreshold: boolean;
}

export interface SelectUntrackedGbpInput {
  name: string;
  industry: string;
  city: string;
  state: string;
  address?: string;
  trackedKeywords: string[];
  gbpSearchTerms: GbpSearchTermInput[];
  /** Max opportunities to return (default 8). */
  limit?: number;
}

export interface SelectUntrackedGbpResult {
  opportunities: UntrackedGbpOpportunity[];
  source: "llm" | "heuristic";
  llmConfigured: boolean;
  warning?: string;
}

interface LlmUntrackedResponse {
  opportunities: Array<{ keyword: string; reason: string }>;
}

const UNTRACKED_SYSTEM = `You are a local SEO expert specializing in Google Maps and Local 3-Pack keyword portfolios.

Your job is to review Google Business Profile search terms and pick which ones this business should ADD to their tracked keyword portfolio for rank monitoring.

Return valid JSON only.`;

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function heuristicOpportunities(
  input: SelectUntrackedGbpInput
): UntrackedGbpOpportunity[] {
  const limit = input.limit ?? 8;
  const tracked = new Set(input.trackedKeywords.map(normalizeKeyword));

  return input.gbpSearchTerms
    .filter((term) => !tracked.has(normalizeKeyword(term.keyword)))
    .sort((a, b) => {
      const aScore = (a.impressions ?? 0) > 0 ? (a.impressions ?? 0) * 2 : a.belowThreshold ? 10 : 1;
      const bScore = (b.impressions ?? 0) > 0 ? (b.impressions ?? 0) * 2 : b.belowThreshold ? 10 : 1;
      return bScore - aScore;
    })
    .slice(0, limit)
    .map((term) => ({
      keyword: normalizeKeyword(term.keyword),
      impressions: term.impressions,
      belowThreshold: term.belowThreshold,
      reason:
        (term.impressions ?? 0) > 0
          ? `Google reports ${term.impressions} impressions — add to align your portfolio with proven Maps demand.`
          : term.belowThreshold
            ? "Appears in your GBP search terms (below reporting threshold) and is not tracked yet."
            : "Untracked GBP search term worth monitoring.",
    }));
}

function sanitizeOpportunities(
  items: Array<{ keyword?: string; reason?: string }>,
  input: SelectUntrackedGbpInput
): UntrackedGbpOpportunity[] {
  const limit = input.limit ?? 8;
  const tracked = new Set(input.trackedKeywords.map(normalizeKeyword));
  const termByKeyword = new Map(
    input.gbpSearchTerms.map((term) => [normalizeKeyword(term.keyword), term])
  );
  const seen = new Set<string>();
  const out: UntrackedGbpOpportunity[] = [];

  for (const item of items) {
    const keyword = normalizeKeyword(item.keyword ?? "");
    const reason = item.reason?.trim();
    if (!keyword || !reason) continue;
    if (tracked.has(keyword)) continue;
    if (!termByKeyword.has(keyword)) continue;
    if (seen.has(keyword)) continue;
    seen.add(keyword);

    const source = termByKeyword.get(keyword)!;
    out.push({
      keyword,
      reason,
      impressions: source.impressions,
      belowThreshold: source.belowThreshold,
    });
    if (out.length >= limit) break;
  }

  return out;
}

export async function selectUntrackedGbpOpportunities(
  input: SelectUntrackedGbpInput
): Promise<SelectUntrackedGbpResult> {
  const limit = input.limit ?? 8;
  const fallback = heuristicOpportunities(input);
  const llmConfigured = isLlmConfigured();

  if (!llmConfigured || input.gbpSearchTerms.length === 0) {
    return {
      opportunities: fallback,
      source: "heuristic",
      llmConfigured,
      warning: llmConfigured
        ? undefined
        : "OPENAI_API_KEY is not configured — ranking by impression volume.",
    };
  }

  try {
    const llm = await completeJson<LlmUntrackedResponse>(
      [
        { role: "system", content: UNTRACKED_SYSTEM },
        {
          role: "user",
          content: `Review these Google Business Profile search terms and pick up to ${limit} keywords this business should ADD to their tracked portfolio.

BUSINESS:
${JSON.stringify(
  {
    name: input.name,
    industry: input.industry,
    city: input.city,
    state: input.state,
    address: input.address,
  },
  null,
  2
)}

CURRENTLY TRACKED KEYWORDS:
${JSON.stringify(input.trackedKeywords, null, 2)}

GBP SEARCH TERMS (from Google Performance API — not yet tracked):
${JSON.stringify(input.gbpSearchTerms, null, 2)}

Selection rules:
- ONLY pick keywords from the GBP SEARCH TERMS list above (exact wording, lowercase)
- Prefer terms with real impression counts, then high-intent service+geo queries, then relevant below-threshold terms
- DO NOT pick competitor brand names (e.g. other daycare chains, other HVAC companies)
- DO NOT pick street addresses, full business listing titles, or research-style queries
- DO NOT pick terms already covered by tracked keywords
- DO pick terms that represent real customer Maps search intent for THIS business's category and market
- Each reason: one concise sentence explaining why this specific term is worth tracking (mention impressions when available)
- Return fewer than ${limit} if most terms are junk or competitor navigational queries

Return JSON:
{
  "opportunities": [
    { "keyword": "daycare las vegas", "reason": "why to track it" }
  ]
}`,
        },
      ],
      { maxTokens: 1400, temperature: 0.3 }
    );

    const opportunities = sanitizeOpportunities(llm.opportunities ?? [], input);

    if (opportunities.length === 0) {
      return {
        opportunities: fallback,
        source: "heuristic",
        llmConfigured: true,
        warning: "AI returned no suitable keywords — ranking by impression volume.",
      };
    }

    return { opportunities, source: "llm", llmConfigured: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM request failed";
    console.error("[llm] untracked GBP selection failed, using heuristic:", error);
    return {
      opportunities: fallback,
      source: "heuristic",
      llmConfigured: true,
      warning: `AI selection failed (${message}) — ranking by impression volume.`,
    };
  }
}
