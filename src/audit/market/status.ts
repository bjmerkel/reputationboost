import { MARKET_DATA_FLAGS } from "@/lib/feature-flags";

export function nextScheduledRankPulse(now: Date): string {
  const candidates: Date[] = [];
  for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + monthOffset;
    for (const day of MARKET_DATA_FLAGS.rankPulseDaysUtc) {
      candidates.push(new Date(Date.UTC(year, month, day, 6, 0, 0)));
    }
  }
  return candidates
    .filter((candidate) => candidate.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0]
    .toISOString();
}
