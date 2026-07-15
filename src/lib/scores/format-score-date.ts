import type { FullAuditPayload } from "@/audit/types";

/** Format a YYYY-MM-DD or ISO timestamp for score "calculated" labels. */
export function formatScoreCalculatedAt(date: string): string {
  const normalized =
    date.length === 10 && !date.includes("T") ? `${date}T12:00:00` : date;
  return new Date(normalized).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Prefer nightly score snapshot date, then last audit completion. */
export function resolveScoreCalculatedAt(
  latestScoreDate: string | null | undefined,
  audit?: FullAuditPayload | null
): string | null {
  if (latestScoreDate) return latestScoreDate;
  if (audit?.completedAt) return audit.completedAt.slice(0, 10);
  return null;
}
