/** Format a star rating for display (two decimal places). */
export function formatStarRating(rating: number): string {
  if (!Number.isFinite(rating)) return "0.00";
  return rating.toFixed(2);
}
