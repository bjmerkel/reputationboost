import { getOpenAiApiKey, getOpenAiModel } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
}

function apiKeyOrThrow(): string {
  const key = getOpenAiApiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

function parseJsonContent<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText) as T;
}

/**
 * OpenAI Chat Completions — server-side only.
 */
export async function completeText(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKeyOrThrow()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      messages,
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 2000,
    }),
  });

  const data = (await res.json()) as OpenAiChatResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!res.ok || !content) {
    throw new Error(data.error?.message ?? `OpenAI request failed (${res.status})`);
  }

  return content.trim();
}

export async function completeJson<T>(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKeyOrThrow()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 3000,
      response_format: { type: "json_object" },
    }),
  });

  const data = (await res.json()) as OpenAiChatResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!res.ok || !content) {
    throw new Error(data.error?.message ?? `OpenAI request failed (${res.status})`);
  }

  return parseJsonContent<T>(content);
}
