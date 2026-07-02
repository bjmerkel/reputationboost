export function getOpenAiApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

export function isLlmConfigured(): boolean {
  return Boolean(getOpenAiApiKey());
}
