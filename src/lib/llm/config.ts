export function getOpenAiApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

export function getOpenAiImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2-2026-04-21";
}

export function isLlmConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}

export function isImageGenerationConfigured(): boolean {
  return isLlmConfigured();
}
