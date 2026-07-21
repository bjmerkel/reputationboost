import type { FullAuditPayload } from "@/audit/types";
import { keywordImpressionWeight } from "@/audit/phase2/scoring";
import type { RevenueMatchMethod } from "./types";

function significantTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["near", "best", "local"].includes(w));
}

function auditKeywords(audit: FullAuditPayload | null): string[] {
  if (!audit) return [];
  const fromPlan = audit.strategy.gbpPlan?.targetKeywords ?? [];
  if (fromPlan.length > 0) return fromPlan;
  return audit.rankings.keywords.map((k) => k.keyword);
}

function exactKeywordMatch(serviceText: string, keywords: string[]): string | null {
  const lower = serviceText.toLowerCase().trim();
  for (const keyword of keywords) {
    if (lower === keyword.toLowerCase()) return keyword;
  }
  return null;
}

function fuzzyKeywordMatch(serviceText: string, keywords: string[]): string | null {
  const lower = serviceText.toLowerCase();
  for (const keyword of keywords) {
    const tokens = significantTokens(keyword);
    if (tokens.length === 0) {
      if (lower.includes(keyword.toLowerCase())) return keyword;
      continue;
    }
    if (tokens.some((token) => lower.includes(token))) return keyword;
  }
  return null;
}

function impressionFallbackKeyword(audit: FullAuditPayload | null): string | null {
  if (!audit) return null;
  const searchKeywords = audit.gbp.performance.searchKeywords ?? [];
  const keywords = auditKeywords(audit);
  if (keywords.length === 0) return null;

  let best: { keyword: string; weight: number } | null = null;
  for (const keyword of keywords) {
    const weight = keywordImpressionWeight(keyword, searchKeywords);
    if (!best || weight > best.weight) {
      best = { keyword, weight };
    }
  }
  return best?.keyword ?? keywords[0] ?? null;
}

export interface KeywordMatchResult {
  keyword: string | null;
  method: RevenueMatchMethod | null;
  confidence: number | null;
}

/** Map CRM service text to an audit keyword with confidence scoring. */
export function matchTransactionToKeyword(
  serviceText: string | undefined,
  audit: FullAuditPayload | null
): KeywordMatchResult {
  const keywords = auditKeywords(audit);
  if (!serviceText?.trim() || keywords.length === 0) {
    const fallback = impressionFallbackKeyword(audit);
    return fallback
      ? { keyword: fallback, method: "impression_fallback", confidence: 0.4 }
      : { keyword: null, method: null, confidence: null };
  }

  const exact = exactKeywordMatch(serviceText, keywords);
  if (exact) {
    return { keyword: exact, method: "service_keyword", confidence: 0.95 };
  }

  const fuzzy = fuzzyKeywordMatch(serviceText, keywords);
  if (fuzzy) {
    return { keyword: fuzzy, method: "fuzzy_keyword", confidence: 0.75 };
  }

  const fallback = impressionFallbackKeyword(audit);
  if (fallback) {
    return { keyword: fallback, method: "impression_fallback", confidence: 0.4 };
  }

  return { keyword: null, method: null, confidence: null };
}
