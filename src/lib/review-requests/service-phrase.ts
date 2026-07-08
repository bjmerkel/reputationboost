export interface ServicePhraseLocation {
  city?: string | null;
  state?: string | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Conversational program name — strips geo/SEO tail from audit keywords. */
export function naturalServicePhrase(
  keyword: string,
  location?: ServicePhraseLocation
): string {
  let phrase = keyword.trim();
  if (!phrase) return phrase;

  phrase = phrase.replace(/^(best|local|top|affordable|cheap|nearby)\s+/i, "");
  phrase = phrase.replace(/\s+near\s+me$/i, "");

  const city = location?.city?.trim();
  const state = location?.state?.trim();

  if (city) {
    const inCity = new RegExp(
      `\\s+in\\s+${escapeRegExp(city)}(?:\\s+${escapeRegExp(state ?? "")})?`,
      "gi"
    );
    phrase = phrase.replace(inCity, "");

    const trailingCity = new RegExp(
      `\\s+${escapeRegExp(city)}(?:\\s+${escapeRegExp(state ?? "")})?$`,
      "i"
    );
    phrase = phrase.replace(trailingCity, "");
  }

  if (state) {
    phrase = phrase.replace(new RegExp(`\\s+${escapeRegExp(state)}$`, "i"), "");
  }

  return phrase.trim() || keyword.trim();
}

export function resolveServiceForSms(options: {
  serviceNotes?: string | null;
  focusKeyword?: string | null;
  location?: ServicePhraseLocation;
}): string {
  const notes = options.serviceNotes?.trim();
  if (notes) {
    return naturalServicePhrase(notes, options.location);
  }

  const keyword = options.focusKeyword?.trim();
  if (keyword) {
    return naturalServicePhrase(keyword, options.location);
  }

  return "your recent visit";
}

/** Rewrites pasted SEO keywords in generated templates back to [SERVICE]. */
export function normalizeKeywordInReviewTemplate(
  template: string,
  focusKeyword: string | null | undefined,
  location?: ServicePhraseLocation
): string {
  if (!focusKeyword?.trim()) return template;

  let result = template;
  const keyword = focusKeyword.trim();
  const natural = naturalServicePhrase(keyword, location);

  const replacements = new Set<string>([keyword]);
  if (natural !== keyword) replacements.add(natural);

  if (location?.city) {
    const city = location.city.trim();
    replacements.add(`${natural} in ${city}`);
    replacements.add(`${natural} in ${city}${location.state ? ` ${location.state.trim()}` : ""}`);
    replacements.add(`${keyword} in ${city}`);
  }

  const phrases = [...replacements].sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    if (!phrase || !result.toLowerCase().includes(phrase.toLowerCase())) continue;
    result = result.replace(new RegExp(escapeRegExp(phrase), "gi"), "[SERVICE]");
  }

  return result;
}
