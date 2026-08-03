/** Normalize YYYY-MM-DD score snapshot dates for timestamp comparison. */
export function scoreDateToIso(date: string): string {
  return `${date}T12:00:00.000Z`;
}

/** Pick the most recent ISO timestamp or score date. */
export function maxActivityTimestamp(
  ...values: Array<string | null | undefined>
): string | null {
  let bestMs: number | null = null;
  let bestValue: string | null = null;

  for (const value of values) {
    if (!value) continue;
    const normalized = value.length === 10 ? scoreDateToIso(value) : value;
    const ms = new Date(normalized).getTime();
    if (!Number.isFinite(ms)) continue;
    if (bestMs === null || ms > bestMs) {
      bestMs = ms;
      bestValue = normalized;
    }
  }

  return bestValue;
}

/** Latest score snapshot date across a user's businesses. */
export function latestScoreDateForBusinesses(
  businessIds: string[],
  scoreByBusiness: Map<string, { score_date?: string | null }>
): string | null {
  const dates = businessIds
    .map((businessId) => scoreByBusiness.get(businessId)?.score_date)
    .filter((date): date is string => typeof date === "string" && date.length > 0);

  if (dates.length === 0) return null;
  return [...dates].sort().at(-1) ?? null;
}
