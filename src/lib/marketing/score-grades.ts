export type ScoreBandId = "excellent" | "good" | "needs_work" | "poor";

export const SCORE_BANDS = [
  {
    id: "excellent" as const,
    label: "Excellent",
    range: "80–100",
    stars: 5,
    color: "#188038",
    bg: "#e6f4ea",
  },
  {
    id: "good" as const,
    label: "Good",
    range: "60–79",
    stars: 4,
    color: "#1a73e8",
    bg: "#e8f0fe",
  },
  {
    id: "needs_work" as const,
    label: "Needs Work",
    range: "40–59",
    stars: 3,
    color: "#e37400",
    bg: "#fef7e0",
  },
  {
    id: "poor" as const,
    label: "Poor",
    range: "20–39",
    stars: 2,
    color: "#d93025",
    bg: "#fce8e6",
  },
] as const;

export function scoreBandFor(score: number) {
  if (score >= 80) return SCORE_BANDS[0];
  if (score >= 60) return SCORE_BANDS[1];
  if (score >= 40) return SCORE_BANDS[2];
  return SCORE_BANDS[3];
}

/** Illustrative benchmark for businesses ranking in the Local 3-Pack. */
export const PACK_LEADER_SCORE_BENCHMARK = 81;
