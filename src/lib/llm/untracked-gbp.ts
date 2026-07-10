import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import { isHighVolumeMapsKeyword } from "./keywords";

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

Google does not publish Maps search volume. Infer high-volume potential from how real customers phrase Maps queries: service + city, service + "near me", core category terms, and common Local Pack phrasing (2–4 words).

Terms marked belowThreshold still appeared in GBP search data — Google only hides the exact impression count when volume is low. Many below-threshold terms are still high-volume Maps queries worth tracking; analyze phrasing, not just the flag.

Return valid JSON only.`;

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapsVolumeContext(input: SelectUntrackedGbpInput) {
  return {
    name: input.name,
    industry: input.industry,
    city: input.city,
    state: input.state,
  };
}

function inferBelowThresholdReason(
  term: GbpSearchTermInput,
  input: SelectUntrackedGbpInput
): string {
  const keyword = normalizeKeyword(term.keyword);
  if (isHighVolumeMapsKeyword(keyword, mapsVolumeContext(input))) {
    return `Below Google's reporting threshold, but phrasing matches a high-volume Maps query (${keyword}) — worth tracking for Local Pack demand.`;
  }
  return `Appears in your GBP search terms (below reporting threshold) — monitor for emerging Maps demand.`;
}

function heuristicScore(
  term: GbpSearchTermInput,
  input: SelectUntrackedGbpInput
): number {
  const impressions = term.impressions ?? 0;
  if (impressions > 0) return impressions * 2;

  if (term.belowThreshold) {
    const keyword = normalizeKeyword(term.keyword);
    if (isHighVolumeMapsKeyword(keyword, mapsVolumeContext(input))) return 55;
    return 12;
  }

  return 1;
}

function heuristicOpportunities(
  input: SelectUntrackedGbpInput
): UntrackedGbpOpportunity[] {
  const limit = input.limit ?? 8;
  const tracked = new Set(input.trackedKeywords.map(normalizeKeyword));

  return input.gbpSearchTerms
    .filter((term) => !tracked.has(normalizeKeyword(term.keyword)))
    .sort((a, b) => heuristicScore(b, input) - heuristicScore(a, input))
    .slice(0, limit)
    .map((term) => ({
      keyword: normalizeKeyword(term.keyword),
      impressions: term.impressions,
      belowThreshold: term.belowThreshold,
      reason:
        (term.impressions ?? 0) > 0
          ? `Google reports ${term.impressions} impressions — add to align your portfolio with proven Maps demand.`
          : term.belowThreshold
            ? inferBelowThresholdReason(term, input)
            : "Untracked GBP search term worth monitoring.",
    }));
}

function formatGbpTermsForPrompt(terms: GbpSearchTermInput[]): string {
  const impressionBacked = terms.filter((term) => (term.impressions ?? 0) > 0);
  const belowThreshold = terms.filter(
    (term) => term.belowThreshold && (term.impressions ?? 0) <= 0
  );

  return JSON.stringify(
    {
      withReportedImpressions: impressionBacked.map((term) => ({
        keyword: term.keyword,
        impressions: term.impressions,
        belowThreshold: false,
      })),
      belowReportingThreshold: belowThreshold.map((term) => ({
        keyword: term.keyword,
        impressions: null,
        belowThreshold: true,
        note: "Google returned this term but hid the exact count — still analyze Maps volume potential from phrasing.",
      })),
    },
    null,
    2
  );
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
        : "OPENAI_API_KEY is not configured — ranking by impressions and inferred Maps volume.",
    };
  }

  const belowThresholdCount = input.gbpSearchTerms.filter(
    (term) => term.belowThreshold && (term.impressions ?? 0) <= 0
  ).length;
  const minBelowThresholdPicks =
    belowThresholdCount > 0 ? Math.min(3, Math.max(1, Math.floor(limit / 3))) : 0;

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
${formatGbpTermsForPrompt(input.gbpSearchTerms)}

Selection rules:
- ONLY pick keywords from the GBP SEARCH TERMS lists above (exact wording, lowercase)
- Balance proven demand (reported impressions) with high-potential below-threshold terms
- Include at least ${minBelowThresholdPicks} below-threshold pick(s) when suitable high-volume Maps queries exist in that list
- For below-threshold terms: infer Google Maps volume from phrasing — prefer service+city, service+"near me", core category queries (e.g. "daycare las vegas", "preschool near me", "hvac repair wayne")
- Below-threshold does NOT mean low value — Google hides counts for many terms that are still common Maps searches
- Prefer short, high-intent Maps queries (2–4 words) over long-tail research phrases
- DO NOT pick competitor brand names (e.g. other daycare chains, other HVAC companies)
- DO NOT pick street addresses, full business listing titles, or research-style queries
- DO NOT pick terms already covered by tracked keywords
- DO pick terms that represent real customer Maps search intent for THIS business's category and market
- Each reason: one concise sentence. For impression-backed terms, cite the count. For below-threshold terms, explain why the phrasing suggests high Maps volume.
- Return fewer than ${limit} if most terms are junk or competitor navigational queries

Return JSON:
{
  "opportunities": [
    { "keyword": "daycare las vegas", "reason": "why to track it" }
  ]
}`,
        },
      ],
      { maxTokens: 1600, temperature: 0.3 }
    );

    const opportunities = sanitizeOpportunities(llm.opportunities ?? [], input);

    if (opportunities.length === 0) {
      return {
        opportunities: fallback,
        source: "heuristic",
        llmConfigured: true,
        warning: "AI returned no suitable keywords — ranking by impressions and inferred Maps volume.",
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
      warning: `AI selection failed (${message}) — ranking by impressions and inferred Maps volume.`,
    };
  }
}
