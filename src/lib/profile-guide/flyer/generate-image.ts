import { getOpenAiApiKey, getOpenAiImageModel } from "@/lib/llm/config";

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string; revised_prompt?: string }>;
  error?: { message?: string };
}

export const FLYER_CANVAS_WIDTH = 1024;
export const FLYER_CANVAS_HEIGHT = 1536;

export function buildFlyerBackgroundRequestBody(
  prompt: string,
  model: string
): Record<string, unknown> {
  const isGptImage = model.includes("gpt-image");

  const body: Record<string, unknown> = {
    model,
    prompt: prompt.trim(),
    n: 1,
    size: `${FLYER_CANVAS_WIDTH}x${FLYER_CANVAS_HEIGHT}`,
    quality: "high",
  };

  if (!isGptImage) {
    body.response_format = "b64_json";
  }

  return body;
}

export async function generateFlyerBackgroundImage(
  prompt: string
): Promise<{ buffer: Buffer; revisedPrompt?: string }> {
  const key = getOpenAiApiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const model = getOpenAiImageModel();
  const body = buildFlyerBackgroundRequestBody(prompt, model);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as OpenAiImageResponse;
  const item = data.data?.[0];

  if (!res.ok || !item?.b64_json) {
    throw new Error(data.error?.message ?? `Image generation failed (${res.status})`);
  }

  return {
    buffer: Buffer.from(item.b64_json, "base64"),
    revisedPrompt: item.revised_prompt,
  };
}
