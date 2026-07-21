import { createHash } from "node:crypto";
import type { ClientConfig } from "@/audit/types";
import type { AiProbeResult, AiVisibilitySurface } from "@/audit/types/ai-visibility";
import { completeJson } from "@/lib/llm/client";
import { isLlmConfigured } from "@/lib/llm/config";
import {
  businessMentionedInText,
  dedupeCompetitors,
  findBusinessPosition,
} from "../mention-extractor";

interface LlmProbeResponse {
  answer: string;
  businesses: Array<{
    name: string;
    position: number;
    recommended?: boolean;
  }>;
  citations?: Array<{
    domain?: string;
    url?: string;
    snippet?: string;
  }>;
}

const SURFACE_INSTRUCTIONS: Record<AiVisibilitySurface, string> = {
  google_ai_overview:
    "Respond like Google AI Overviews summarizing local search results with citations.",
  chatgpt:
    "Respond like ChatGPT recommending local businesses to a consumer asking for help choosing a provider.",
  gemini:
    "Respond like Gemini with Google Search grounding, listing local business recommendations.",
};

function hashResponse(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export async function probeWithOpenAi(
  client: ClientConfig,
  surface: AiVisibilitySurface,
  keyword: string,
  queryText: string
): Promise<AiProbeResult> {
  if (!isLlmConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const city = client.location.city || "the local area";
  const state = client.location.state || "";

  const llm = await completeJson<LlmProbeResponse>(
    [
      {
        role: "system",
        content: `${SURFACE_INSTRUCTIONS[surface]}
Return JSON with:
- answer: 2-4 sentence recommendation summary
- businesses: up to 5 local businesses in recommendation order with position (1 = top pick) and recommended boolean
- citations: optional list of source domains/urls referenced

Use realistic local business names for ${city}${state ? `, ${state}` : ""}. Include well-known local providers when plausible.`,
      },
      {
        role: "user",
        content: `Query: "${queryText}"
Industry context: ${client.industry}
Target business to evaluate (do not favor unless genuinely appropriate): ${client.name}`,
      },
    ],
    { temperature: 0.4, maxTokens: 1200 }
  );

  const competitorsNamed = dedupeCompetitors(
    (llm.businesses ?? []).map((business) => ({
      name: business.name,
      position: business.position,
    }))
  );

  const mentioned = businessMentionedInText(client.name, llm.answer ?? "");
  const position = findBusinessPosition(client.name, competitorsNamed);
  const recommended = position != null && position <= 3;

  const answerExcerpt = (llm.answer ?? "").slice(0, 500);
  const citations = (llm.citations ?? [])
    .filter((citation) => citation.domain || citation.url)
    .map((citation) => ({
      domain: citation.domain ?? new URL(citation.url!).hostname,
      url: citation.url ?? null,
      snippet: citation.snippet ?? null,
    }));

  return {
    surface,
    keyword,
    queryText,
    mentioned: mentioned || position != null,
    recommended,
    position,
    competitorsNamed,
    citations,
    answerExcerpt,
    rawResponseHash: hashResponse(JSON.stringify(llm)),
  };
}
