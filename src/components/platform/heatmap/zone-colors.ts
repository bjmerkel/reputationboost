import type { ZoneSeverity } from "@/audit/geo/types";

export const ZONE_SEVERITY_COLORS: Record<ZoneSeverity, { fill: string; stroke: string; text: string }> = {
  strong: { fill: "#34a853", stroke: "#188038", text: "#137333" },
  moderate: { fill: "#fbbc04", stroke: "#f9ab00", text: "#b06000" },
  weak: { fill: "#fa7b17", stroke: "#e8710a", text: "#b06000" },
  critical: { fill: "#ea4335", stroke: "#c5221f", text: "#c5221f" },
};

export function coverageColor(percent: number): string {
  if (percent >= 60) return "#34a853";
  if (percent >= 30) return "#fbbc04";
  return "#ea4335";
}
