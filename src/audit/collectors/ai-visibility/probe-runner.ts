import type { ClientConfig } from "@/audit/types";
import type { AiProbeResult, AiVisibilitySurface } from "@/audit/types/ai-visibility";
import { AI_VISIBILITY_FLAGS } from "@/lib/feature-flags";
import { isLlmConfigured } from "@/lib/llm/config";
import { buildAiQueryVariants } from "./query-variants";
import { buildAiVisibilitySnapshot } from "./scoring";
import { probeDemo } from "./providers/demo";
import { probeWithOpenAi } from "./providers/openai-probe";
import type { AiVisibilitySnapshot } from "@/audit/types/ai-visibility";

function surfacesForClient(_client: ClientConfig): AiVisibilitySurface[] {
  return [...AI_VISIBILITY_FLAGS.surfaces];
}

async function runProbe(
  client: ClientConfig,
  surface: AiVisibilitySurface,
  keyword: string,
  queryText: string
): Promise<AiProbeResult> {
  if (isLlmConfigured()) {
    try {
      return await probeWithOpenAi(client, surface, keyword, queryText);
    } catch (error) {
      console.warn(
        `[ai-visibility] OpenAI probe failed for ${client.id}/${keyword}/${surface}:`,
        error
      );
    }
  }
  return probeDemo(client, surface, keyword, queryText);
}

export async function collectAiVisibilityProbes(client: ClientConfig): Promise<{
  probes: AiProbeResult[];
  keywords: string[];
  source: AiVisibilitySnapshot["source"];
}> {
  const keywords = client.keywords.slice(0, AI_VISIBILITY_FLAGS.maxKeywords);
  const city = client.location.city || "your area";
  const state = client.location.state || "";
  const surfaces = surfacesForClient(client);
  const probes: AiProbeResult[] = [];

  for (const keyword of keywords) {
    const queries = buildAiQueryVariants(keyword, city, state);
    for (const surface of surfaces) {
      for (const queryText of queries) {
        const probe = await runProbe(client, surface, keyword, queryText);
        probes.push(probe);
      }
    }
  }

  return {
    probes,
    keywords,
    source: isLlmConfigured() ? "api" : "demo",
  };
}

export async function collectAiVisibilitySnapshot(
  client: ClientConfig
): Promise<AiVisibilitySnapshot> {
  const { probes, keywords, source } = await collectAiVisibilityProbes(client);
  return buildAiVisibilitySnapshot(probes, keywords, source);
}

export function probesToSnapshotRows(
  probes: AiProbeResult[],
  businessId: string,
  date: string
) {
  return probes.map((probe) => ({
    businessId,
    keyword: probe.keyword,
    queryText: probe.queryText,
    surface: probe.surface,
    date,
    mentioned: probe.mentioned,
    recommended: probe.recommended,
    position: probe.position,
    competitorsNamed: probe.competitorsNamed,
    citations: probe.citations,
    answerExcerpt: probe.answerExcerpt,
    rawResponseHash: probe.rawResponseHash,
    source: isLlmConfigured() ? ("api" as const) : ("demo" as const),
  }));
}
