import type { AiNamedCompetitor } from "@/audit/types/ai-visibility";

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(normalizeName(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function businessMentionedInText(businessName: string, text: string): boolean {
  const normalizedText = normalizeName(text);
  const normalizedName = normalizeName(businessName);
  if (!normalizedName) return false;
  if (normalizedText.includes(normalizedName)) return true;

  const nameTokens = normalizedName.split(" ").filter((token) => token.length > 2);
  if (nameTokens.length === 0) return false;

  const matched = nameTokens.filter((token) => normalizedText.includes(token));
  if (matched.length < Math.max(2, nameTokens.length - 1)) return false;

  const firstToken = nameTokens[0];
  return firstToken ? normalizedText.includes(firstToken) : false;
}

export function namesLikelyMatch(a: string, b: string): boolean {
  const normalizedA = normalizeName(a);
  const normalizedB = normalizeName(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true;
  return tokenOverlap(a, b) >= 0.8;
}

export function findBusinessPosition(
  businessName: string,
  competitors: AiNamedCompetitor[]
): number | null {
  for (const competitor of competitors) {
    if (namesLikelyMatch(competitor.name, businessName)) {
      return competitor.position;
    }
  }
  return null;
}

export function dedupeCompetitors(competitors: AiNamedCompetitor[]): AiNamedCompetitor[] {
  const seen = new Set<string>();
  const result: AiNamedCompetitor[] = [];

  for (const competitor of competitors.sort((a, b) => a.position - b.position)) {
    const key = normalizeName(competitor.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(competitor);
  }

  return result;
}
