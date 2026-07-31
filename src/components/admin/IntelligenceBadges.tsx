import type { ChurnRiskLevel } from "@/lib/admin/health";
import { churnRiskLevelLabel, healthIndexTone } from "@/lib/admin/health";

export function HealthIndexBadge({ index }: { index: number | null }) {
  if (index === null) {
    return <span className="text-sm text-slate-500">—</span>;
  }

  const tone = healthIndexTone(index);
  const toneClass =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-red-400"
          : "text-slate-400";

  return <span className={`text-sm font-semibold ${toneClass}`}>{index}</span>;
}

export function ChurnRiskBadge({
  risk,
  level,
}: {
  risk: number;
  level: ChurnRiskLevel;
}) {
  const toneClass =
    level === "high"
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : level === "medium"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass}`}>
      {churnRiskLevelLabel(level)} · {risk}%
    </span>
  );
}
