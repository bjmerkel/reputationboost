import type { KeywordRelevanceFeatures, Phase1AuditPayload } from "@/audit/types";
import { completeJson } from "./client";
import { isLlmConfigured } from "./config";
import {
  extractKeywordRelevanceHeuristic,
  relevanceByKeyword,
} from "@/audit/phase2/relevance-heuristic";

interface LlmKeywordRelevanceItem {
  keyword: string;
  categoryFit?: number;
  servicesCoverage?: boolean;
  descriptionCoverage?: boolean;
  reviewMentions?: number;
  postCoverage?: boolean;
  competitorGaps?: string[];
  recommendation?: string;
}

interface LlmRelevanceResponse {
  keywords: LlmKeywordRelevanceItem[];
}

const RELEVANCE_SYSTEM = `You are a local SEO analyst specializing in Google Business Profile relevance for Local 3-Pack rankings.
Evaluate how well a business profile matches each target keyword's search intent.
Return valid JSON only. Do not invent data not present in the context.`;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildRelevanceContext(audit: Phase1AuditPayload): string {
  const live = audit.gbp.liveProfile;
  const reviewsSample = audit.reviews.reviews
    .slice(0, 12)
    .map((r) => `- (${r.rating}★) ${r.text.slice(0, 200)}`)
    .join("\n");

  const competitorBlocks = audit.competitors
    .map((snap) => {
      const leaders = snap.competitors
        .slice(0, 3)
        .map(
          (c) =>
            `  - ${c.name}: category=${c.primaryCategory}, ${c.reviewCount} reviews, ${c.photoCount} photos`
        )
        .join("\n");
      return `Keyword "${snap.keyword}":\n${leaders || "  (no competitors)"}`;
    })
    .join("\n\n");

  return `BUSINESS: ${audit.clientName}
PRIMARY CATEGORY: ${live?.primaryCategory ?? audit.gbp.identity.primaryCategory}
SECONDARY CATEGORIES: ${(live?.secondaryCategories ?? audit.gbp.identity.secondaryCategories).join(", ") || "none"}
DESCRIPTION (${(live?.description ?? "").length} chars):
${(live?.description ?? "empty").slice(0, 600)}

SERVICES:
${(live?.services ?? []).map((s) => `- ${s.name}: ${s.description.slice(0, 120)}`).join("\n") || "none"}

RECENT POSTS:
${(audit.gbp.recentPosts ?? []).map((p) => `- ${p.summary.slice(0, 120)}`).join("\n") || "none"}

TRACKED KEYWORDS:
${audit.rankings.keywords.map((k) => `- "${k.keyword}" — ${k.inLocalPack ? `#${k.localPackPosition} in pack` : "outside pack"}`).join("\n")}

SAMPLE REVIEWS:
${reviewsSample || "none"}

PACK COMPETITORS BY KEYWORD:
${competitorBlocks || "none"}`;
}

function mergeLlmWithHeuristic(
  heuristic: KeywordRelevanceFeatures,
  llm: LlmKeywordRelevanceItem
): KeywordRelevanceFeatures {
  const categoryFit = clampScore(
    typeof llm.categoryFit === "number" ? llm.categoryFit : heuristic.categoryFit
  );
  const servicesCoverage = llm.servicesCoverage ?? heuristic.servicesCoverage;
  const descriptionCoverage = llm.descriptionCoverage ?? heuristic.descriptionCoverage;
  const reviewMentions =
    typeof llm.reviewMentions === "number"
      ? llm.reviewMentions
      : heuristic.reviewMentions;
  const postCoverage = llm.postCoverage ?? heuristic.postCoverage;
  const competitorGaps =
    Array.isArray(llm.competitorGaps) && llm.competitorGaps.length > 0
      ? llm.competitorGaps.filter((g) => typeof g === "string" && g.trim()).slice(0, 4)
      : heuristic.competitorGaps;

  const score = clampScore(
    categoryFit * 0.25 +
      (descriptionCoverage ? 100 : 0) * 0.2 +
      (servicesCoverage ? 100 : 0) * 0.25 +
      Math.min(100, reviewMentions * 25) * 0.2 +
      (postCoverage ? 100 : 0) * 0.1
  );

  const recommendation =
    llm.recommendation?.trim() || heuristic.recommendation;

  return {
    keyword: heuristic.keyword,
    score,
    categoryFit,
    servicesCoverage,
    descriptionCoverage,
    reviewMentions,
    postCoverage,
    competitorGaps,
    recommendation,
    source: "hybrid",
  };
}

/**
 * Extract per-keyword relevance features via LLM structured extraction.
 * Falls back to heuristics when LLM is unavailable or returns sparse data.
 */
export async function extractKeywordRelevance(
  audit: Phase1AuditPayload
): Promise<{ features: KeywordRelevanceFeatures[]; source: "llm" | "heuristic" | "hybrid" }> {
  const heuristic = extractKeywordRelevanceHeuristic(audit);

  if (!isLlmConfigured() || audit.rankings.keywords.length === 0) {
    return { features: heuristic, source: "heuristic" };
  }

  try {
    const llm = await completeJson<LlmRelevanceResponse>(
      [
        { role: "system", content: RELEVANCE_SYSTEM },
        {
          role: "user",
          content: `${buildRelevanceContext(audit)}

For EACH tracked keyword, assess profile relevance for Local 3-Pack ranking.

Rules:
- categoryFit: 0-100 — does primary/secondary category match keyword intent? (e.g. "stucco repair" needs "Stucco contractor" not generic "Contractor")
- servicesCoverage, descriptionCoverage, postCoverage: booleans based on actual profile text
- reviewMentions: count of reviews mentioning the keyword or its core service terms
- competitorGaps: 1-3 specific gaps vs top-3 pack winners for this keyword (category, review themes, content)
- recommendation: one actionable sentence to improve relevance

Return JSON:
{
  "keywords": [
    {
      "keyword": "exact keyword from list",
      "categoryFit": 45,
      "servicesCoverage": false,
      "descriptionCoverage": true,
      "reviewMentions": 2,
      "postCoverage": false,
      "competitorGaps": ["Pack winners use category X"],
      "recommendation": "Change primary category to X and add Y service"
    }
  ]
}`,
        },
      ],
      { maxTokens: 2000, temperature: 0.3 }
    );

    const llmByKeyword = new Map(
      (llm.keywords ?? [])
        .filter((k) => k.keyword?.trim())
        .map((k) => [k.keyword.toLowerCase(), k])
    );

    if (llmByKeyword.size === 0) {
      return { features: heuristic, source: "heuristic" };
    }

    const features = heuristic.map((base) => {
      const llmItem = llmByKeyword.get(base.keyword.toLowerCase());
      return llmItem ? mergeLlmWithHeuristic(base, llmItem) : base;
    });

    const hybridCount = features.filter((f) => f.source === "hybrid").length;
    return {
      features,
      source: hybridCount === features.length ? "hybrid" : "heuristic",
    };
  } catch (error) {
    console.error("[llm] relevance extraction failed, using heuristics:", error);
    return { features: heuristic, source: "heuristic" };
  }
}

/** Lookup relevance for a single keyword from cached audit features. */
export function keywordRelevanceFor(
  audit: Phase1AuditPayload,
  keyword: string
): KeywordRelevanceFeatures | undefined {
  return relevanceByKeyword(audit).get(keyword.toLowerCase());
}
