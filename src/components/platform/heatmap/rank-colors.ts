export function rankColor(rank: number | null): string {
  if (rank !== null && rank <= 3) return "#34a853";
  if (rank !== null && rank <= 10) return "#c5221f";
  return "#ea4335";
}
