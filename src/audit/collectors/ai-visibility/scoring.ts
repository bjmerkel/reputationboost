import type {
  AiProbeResult,
  AiVisibilityKeywordSnapshot,
  AiVisibilitySnapshot,
} from "@/audit/types/ai-visibility";
import { dedupeCompetitors } from "./mention-extractor";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function positionScore(position: number | null): number {
  if (position == null) return 0;
  if (position <= 1) return 100;
  if (position === 2) return 80;
  if (position === 3) return 60;
  if (position === 4) return 40;
  return 20;
}

function citationQualityScore(citations: AiProbeResult["citations"]): number {
  if (citations.length === 0) return 0;
  const owned = citations.some((citation) =>
    /google\.com|business\.site|maps\.app\.goo\.gl/i.test(citation.domain)
  );
  if (owned) return 100;
  const directory = citations.some((citation) =>
    /yelp\.com|bbb\.org|angi\.com|homeadvisor\.com|thumbtack\.com/i.test(citation.domain)
  );
  return directory ? 60 : 30;
}

export function scoreKeywordProbes(
  keyword: string,
  probes: AiProbeResult[]
): AiVisibilityKeywordSnapshot {
  const total = probes.length;
  const mentionedCount = probes.filter((probe) => probe.mentioned).length;
  const recommendedCount = probes.filter((probe) => probe.recommended).length;
  const mentionRate = total > 0 ? mentionedCount / total : 0;
  const recommendationRate = total > 0 ? recommendedCount / total : 0;

  const positions = probes
    .map((probe) => probe.position)
    .filter((position): position is number => position != null);
  const avgPosition =
    positions.length > 0
      ? positions.reduce((sum, position) => sum + position, 0) / positions.length
      : null;

  const avgPositionScore =
    positions.length > 0
      ? positions.reduce((sum, position) => sum + positionScore(position), 0) / positions.length
      : 0;
  const avgCitationScore =
    probes.length > 0
      ? probes.reduce((sum, probe) => sum + citationQualityScore(probe.citations), 0) / probes.length
      : 0;

  const score = clamp(
    40 * mentionRate * 100 +
      30 * recommendationRate * 100 +
      20 * avgPositionScore +
      10 * avgCitationScore
  );

  const surfaces = ["google_ai_overview", "chatgpt", "gemini"] as const;
  const surfaceSummaries = surfaces
    .map((surface) => {
      const surfaceProbes = probes.filter((probe) => probe.surface === surface);
      if (surfaceProbes.length === 0) return null;
      const mentioned = surfaceProbes.some((probe) => probe.mentioned);
      const recommended = surfaceProbes.some((probe) => probe.recommended);
      const position =
        surfaceProbes.find((probe) => probe.position != null)?.position ?? null;
      const answerExcerpt = surfaceProbes.find((probe) => probe.answerExcerpt)?.answerExcerpt ?? "";
      return { surface, mentioned, recommended, position, answerExcerpt };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const competitorsNamed = dedupeCompetitors(
    probes.flatMap((probe) => probe.competitorsNamed)
  ).slice(0, 5);

  return {
    keyword,
    queriesProbed: total,
    mentionRate,
    recommendationRate,
    avgPosition,
    score,
    surfaces: surfaceSummaries,
    competitorsNamed,
  };
}

export function buildAiVisibilitySnapshot(
  probes: AiProbeResult[],
  keywords: string[],
  source: AiVisibilitySnapshot["source"]
): AiVisibilitySnapshot {
  const keywordSnapshots = keywords.map((keyword) =>
    scoreKeywordProbes(
      keyword,
      probes.filter((probe) => probe.keyword === keyword)
    )
  );

  const keywordsMentioned = keywordSnapshots.filter((row) => row.mentionRate > 0).length;
  const overallScore =
    keywordSnapshots.length > 0
      ? clamp(
          keywordSnapshots.reduce((sum, row) => sum + row.score, 0) / keywordSnapshots.length
        )
      : 0;

  return {
    collectedAt: new Date().toISOString(),
    keywords: keywordSnapshots,
    keywordsMentioned,
    totalKeywords: keywords.length,
    overallScore,
    source,
  };
}
