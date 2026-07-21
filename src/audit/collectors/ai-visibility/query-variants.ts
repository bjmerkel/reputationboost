/** Map tracked keywords to AI-native query shapes for visibility probes. */
export function buildAiQueryVariants(
  keyword: string,
  city: string,
  state: string
): string[] {
  const cityState = state ? `${city}, ${state}` : city;
  const normalized = keyword.trim().toLowerCase();
  const hasNearMe = normalized.includes("near me");
  const hasCity = normalized.includes(city.toLowerCase());

  const variants = new Set<string>();

  if (hasNearMe) {
    variants.add(`best ${keyword}`);
    variants.add(`who should I call for ${keyword.replace(/\s*near me\s*/i, "").trim()} in ${cityState}`);
  } else if (hasCity) {
    variants.add(`best ${keyword}`);
    variants.add(`${keyword} near me`);
  } else {
    variants.add(`best ${keyword} near me`);
    variants.add(`who should I call for ${keyword} in ${cityState}`);
  }

  return [...variants].slice(0, 2);
}
