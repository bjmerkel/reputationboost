import { googleMapsUrlForBusiness } from "@/lib/google/maps-url";

const REVIEW_LINK_PLACEHOLDER = "[REVIEW_LINK]";

/**
 * Direct "write a review" URL — opens Google's review composer for a Place ID.
 */
export function googleWriteReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function googleReviewUrlForBusiness(options: {
  placeId?: string | null;
  mapsUrl?: string | null;
  name?: string;
  address?: string;
}): string | null {
  const placeId = options.placeId?.trim();
  if (placeId) {
    return googleWriteReviewUrl(placeId);
  }

  return googleMapsUrlForBusiness({
    mapsUrl: options.mapsUrl,
    name: options.name,
    address: options.address,
  });
}

export function substituteReviewLink(
  template: string,
  reviewUrl: string,
  placeholders: Record<string, string> = {}
): string {
  let message = template.replaceAll(REVIEW_LINK_PLACEHOLDER, reviewUrl);

  for (const [key, value] of Object.entries(placeholders)) {
    message = message.replaceAll(`[${key}]`, value);
  }

  return message;
}

export function hasReviewLinkPlaceholder(template: string): boolean {
  return template.includes(REVIEW_LINK_PLACEHOLDER);
}
