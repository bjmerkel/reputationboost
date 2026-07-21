import type { ClientConfig } from "@/audit/types";
import type { AiProbeResult, AiVisibilitySurface } from "@/audit/types/ai-visibility";
import { createHash } from "node:crypto";

function hashSeed(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

function demoMentioned(client: ClientConfig, keyword: string, surface: AiVisibilitySurface): boolean {
  const seed = hashSeed([client.id, keyword, surface]);
  const bucket = parseInt(seed.slice(0, 2), 16) % 100;
  const inPack = keyword.toLowerCase().includes("near me") ? bucket < 35 : bucket < 55;
  return inPack;
}

export function probeDemo(
  client: ClientConfig,
  surface: AiVisibilitySurface,
  keyword: string,
  queryText: string
): AiProbeResult {
  const mentioned = demoMentioned(client, keyword, surface);
  const competitorsNamed = [
    { name: `${client.location.city || "Local"} Pro Services`, position: 1 },
    { name: "Trusted Local Experts", position: 2 },
    { name: "Premier Home Solutions", position: 3 },
  ];

  if (mentioned) {
    competitorsNamed.splice(1, 0, { name: client.name, position: 2 });
    competitorsNamed.forEach((row, index) => {
      row.position = index + 1;
    });
  }

  const position = mentioned ? competitorsNamed.find((row) => row.name === client.name)?.position ?? 2 : null;

  return {
    surface,
    keyword,
    queryText,
    mentioned,
    recommended: mentioned && (position ?? 99) <= 3,
    position,
    competitorsNamed: competitorsNamed.slice(0, 5),
    citations: mentioned
      ? [{ domain: "google.com", url: "https://www.google.com/maps", snippet: client.name }]
      : [{ domain: "yelp.com", url: "https://www.yelp.com", snippet: competitorsNamed[0]?.name }],
    answerExcerpt: mentioned
      ? `For "${queryText}", ${client.name} is a solid local option with strong reviews in ${client.location.city}.`
      : `For "${queryText}", top picks include ${competitorsNamed[0]?.name} and ${competitorsNamed[1]?.name}.`,
    rawResponseHash: hashSeed([client.id, keyword, surface, queryText]),
  };
}
