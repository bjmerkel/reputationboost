/** Deep link to report a review in Google Business Profile Manager. */
export function buildGbpReviewReportUrl(placeId?: string | null): string {
  if (placeId) {
    return `https://business.google.com/reviews?placeid=${encodeURIComponent(placeId)}`;
  }
  return "https://business.google.com/reviews";
}
