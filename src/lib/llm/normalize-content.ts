/** Coerce LLM output (string or structured post object) into display/publish text. */
export function normalizeTextContent(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const post =
      obj.post ?? obj.content ?? obj.text ?? obj.body ?? obj.copy ?? obj.message;
    const cta = obj.cta ?? obj.callToAction ?? obj.call_to_action;

    const postText = typeof post === "string" ? post.trim() : "";
    const ctaText = typeof cta === "string" ? cta.trim() : "";

    if (postText && ctaText) return `${postText}\n\n${ctaText}`;
    if (postText) return postText;
    if (ctaText) return ctaText;
  }

  return String(value);
}

export function normalizeTextList(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return fallback;

  const normalized = values
    .map((item) => normalizeTextContent(item))
    .filter((text) => text.length > 0);

  return normalized.length > 0 ? normalized : fallback;
}

export function normalizeOptionalText(
  value: unknown,
  fallback: string
): string {
  const text = normalizeTextContent(value);
  return text || fallback;
}
