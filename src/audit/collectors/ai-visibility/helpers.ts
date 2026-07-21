import type {
  AiVisibilityKeywordSnapshot,
  AiVisibilitySnapshot,
} from "@/audit/types/ai-visibility";

export function keywordSnapshotFromVisibility(
  snapshot: AiVisibilitySnapshot | null | undefined,
  keyword: string
): AiVisibilityKeywordSnapshot | null {
  if (!snapshot) return null;
  return snapshot.keywords.find((row) => row.keyword === keyword) ?? null;
}

export function formatAiSurface(surface: string): string {
  if (surface === "google_ai_overview") return "AI Overviews";
  if (surface === "chatgpt") return "ChatGPT";
  if (surface === "gemini") return "Gemini";
  return surface;
}

export function aiMentionLabel(score: number, mentionRate: number): string {
  if (mentionRate <= 0) return "Not mentioned by AI";
  if (score >= 70) return "Recommended by AI";
  if (score >= 40) return "Sometimes mentioned";
  return "Rarely mentioned";
}
