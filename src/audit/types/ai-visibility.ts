export type AiVisibilitySurface = "google_ai_overview" | "chatgpt" | "gemini";

export interface AiNamedCompetitor {
  name: string;
  position: number;
  placeId?: string | null;
}

export interface AiCitation {
  domain: string;
  url?: string | null;
  snippet?: string | null;
}

export interface AiProbeResult {
  surface: AiVisibilitySurface;
  keyword: string;
  queryText: string;
  mentioned: boolean;
  recommended: boolean;
  position: number | null;
  competitorsNamed: AiNamedCompetitor[];
  citations: AiCitation[];
  answerExcerpt: string;
  rawResponseHash: string;
}

export interface AiVisibilityKeywordSnapshot {
  keyword: string;
  queriesProbed: number;
  mentionRate: number;
  recommendationRate: number;
  avgPosition: number | null;
  score: number;
  surfaces: Array<{
    surface: AiVisibilitySurface;
    mentioned: boolean;
    recommended: boolean;
    position: number | null;
    answerExcerpt: string;
  }>;
  competitorsNamed: AiNamedCompetitor[];
}

export interface AiVisibilitySnapshot {
  collectedAt: string;
  keywords: AiVisibilityKeywordSnapshot[];
  keywordsMentioned: number;
  totalKeywords: number;
  overallScore: number;
  source: "api" | "demo" | "cached";
}

export interface AiVisibilitySnapshotRow {
  businessId: string;
  keyword: string;
  queryText: string;
  surface: AiVisibilitySurface;
  date: string;
  mentioned: boolean;
  recommended: boolean;
  position: number | null;
  competitorsNamed: AiNamedCompetitor[];
  citations: AiCitation[];
  answerExcerpt: string | null;
  rawResponseHash: string | null;
  source: "api" | "demo" | "cached";
}
