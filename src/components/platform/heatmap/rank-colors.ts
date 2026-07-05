export function rankColor(rank: number | null): string {
  if (rank === null) return "#9aa0a6";
  if (rank <= 3) return "#34a853";
  if (rank <= 10) return "#fbbc04";
  return "#ea4335";
}
