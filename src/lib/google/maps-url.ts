export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function isGoogleMapsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("google.") && parsed.pathname.includes("/maps");
  } catch {
    return false;
  }
}

/**
 * Prefer the canonical Maps URL from Places API (`url` / `googleMapsUri`).
 * Fall back to a name+address search only when no API URL is available.
 */
export function googleMapsUrlForBusiness(options: {
  mapsUrl?: string | null;
  name?: string;
  address?: string;
}): string | null {
  const direct = options.mapsUrl?.trim();
  if (direct && isGoogleMapsUrl(direct)) {
    return direct;
  }

  const query = [options.name, options.address].filter(Boolean).join(", ");
  return query ? googleMapsSearchUrl(query) : null;
}
