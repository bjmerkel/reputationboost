import type {
  KeywordPortfolioAnalysis,
  Phase1AuditPayload,
  UntrackedGbpKeywordCandidate,
} from "@/audit/types";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";

interface LlmUntrackedPick {
  keyword: string;
  reason: string;
  priority?: number;
}

interface LlmUntrackedResponse {
  picks: LlmUntrackedPick[];
}

const SYSTEM = `You are a local SEO analyst for Google Maps / Local 3-Pack tracking.
Given a business and untracked Google Business Profile search terms, pick the best keywords to ADD to the tracked portfolio.

Prefer high-volume Maps-style queries: service + city, service + near me, category phrases parents/customers actually type.
Reject competitor brand names, street addresses, ZIP-only, research questions, and brand-only navigational terms unless rewritten into a category+geo query already present in the candidate list.

Only choose from the provided candidate list. Do not invent new keywords.
Return valid JSON only.`;

function normalize(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Rank/explain untracked GBP opportunities with an LLM.
 * Falls back to the heuristic list when LLM is unavailable.
 */
export async function enrichUntrackedCandidatesWithLlm(
  audit: Phase1AuditPayload,
  portfolio: KeywordPortfolioAnalysis
): Promise<KeywordPortfolioAnalysis> {
  if (!portfolio.untrackedCandidates.length || !isLlmConfigured()) {
    return portfolio;
  }

  const candidates = portfolio.untrackedCandidates;
  const byKey = new Map(candidates.map((c) => [normalize(c.keyword), c]));

  try {
    const llm = await completeJson<LlmUntrackedResponse>(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `BUSINESS:
${JSON.stringify(
  {
    name: audit.clientName,
    category: audit.gbp.identity.primaryCategory,
    address: audit.gbp.identity.address,
  },
  null,
  2
)}

ALREADY TRACKED:
${JSON.stringify(
  audit.rankings.keywords.map((k) => k.keyword),
  null,
  2
)}

CANDIDATES (choose the best 8–16 for Maps rank tracking):
${JSON.stringify(
  candidates.map((c) => ({
    keyword: c.keyword,
    sourceGbpTerm: c.sourceGbpTerm,
    impressions: c.impressions,
    belowThreshold: c.belowThreshold,
    heuristicScore: c.opportunityScore,
    heuristicReason: c.reason,
  })),
  null,
  2
)}

Rules:
- Pick 8–16 keywords from CANDIDATES only
- Rank by likely Maps demand + fit for THIS business
- reason: one concise sentence explaining why this is worth tracking
- priority: 1 = best opportunity

Return JSON:
{
  "picks": [
    { "keyword": "example", "reason": "why track it", "priority": 1 }
  ]
}`,
        },
      ],
      { maxTokens: 1600, temperature: 0.3 }
    );

    const picks = Array.isArray(llm.picks) ? llm.picks : [];
    const ranked: UntrackedGbpKeywordCandidate[] = [];
    const seen = new Set<string>();

    for (const [index, pick] of picks.entries()) {
      const key = normalize(pick.keyword ?? "");
      const base = byKey.get(key);
      if (!base || seen.has(key)) continue;
      seen.add(key);
      const priority = typeof pick.priority === "number" ? pick.priority : index + 1;
      const llmReason = pick.reason?.trim();
      ranked.push({
        ...base,
        llmReason: llmReason || undefined,
        llmPriority: priority,
        reason: llmReason || base.reason,
        // Boost score so LLM-ranked items stay on top if callers re-sort.
        opportunityScore: base.opportunityScore + Math.max(0, 200 - priority * 5),
      });
    }

    if (ranked.length === 0) return portfolio;

    // Append remaining heuristic candidates the model skipped.
    for (const candidate of candidates) {
      const key = normalize(candidate.keyword);
      if (seen.has(key)) continue;
      ranked.push(candidate);
    }

    return {
      ...portfolio,
      untrackedCandidates: ranked.slice(0, 24),
      untrackedLlmRanked: true,
      untrackedDemandCount: ranked.filter(
        (c) => (c.impressions ?? 0) > 0 || c.belowThreshold
      ).length,
    };
  } catch (error) {
    console.error("[llm] untracked GBP ranking failed:", error);
    return portfolio;
  }
}
