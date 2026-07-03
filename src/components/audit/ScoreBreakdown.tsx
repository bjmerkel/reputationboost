import type { HealthScores, ScoreComponent } from "@/audit/types";

const COMPONENT_META: Record<
  ScoreComponent,
  { label: string; description: string; color: string }
> = {
  visibility: {
    label: "Visibility",
    description: "Keyword rankings in Google Maps",
    color: "#1a73e8",
  },
  conversion: {
    label: "Conversion",
    description: "Profile trust — reviews, photos, posts",
    color: "#007b83",
  },
  revenueCapture: {
    label: "Revenue capture",
    description: "Share of map clicks you're winning",
    color: "#188038",
  },
};

export function normalizeHealthScores(scores: HealthScores | undefined | null): HealthScores | null {
  if (!scores) return null;
  if (
    Number.isFinite(scores.visibility) &&
    Number.isFinite(scores.conversion) &&
    Number.isFinite(scores.revenueCapture)
  ) {
    return scores;
  }
  return {
    ...scores,
    visibility: scores.localPackCoverage ?? 0,
    conversion: scores.reviewStrength ?? 0,
    revenueCapture: scores.competitiveGap ?? 0,
    insight: scores.insight ?? {
      weakestComponent: "visibility",
      topOpportunityKeyword: null,
      nextAction: null,
    },
    engagementOutcomes: scores.engagementOutcomes ?? {
      calls: 0,
      directions: 0,
      websiteClicks: 0,
      profileViews: scores.engagement ?? 0,
    },
  };
}

function ScoreBar({
  label,
  value,
  color,
  description,
  compact,
}: {
  label: string;
  value: number;
  color: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium text-[#3c4043] ${compact ? "text-xs" : "text-sm"}`}>{label}</span>
        <span className={`font-semibold text-[#202124] ${compact ? "text-xs" : "text-sm"}`}>{value}/100</span>
      </div>
      {!compact && description && (
        <p className="mt-0.5 text-[10px] text-[#80868b]">{description}</p>
      )}
      <div className={`overflow-hidden rounded-full bg-[#e8eaed] ${compact ? "mt-1 h-1.5" : "mt-1.5 h-2"}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function ScoreBreakdown({
  scores,
  compact = false,
  showInsight = true,
}: {
  scores: HealthScores;
  compact?: boolean;
  showInsight?: boolean;
}) {
  const normalized = normalizeHealthScores(scores);
  if (!normalized) return null;

  const components: ScoreComponent[] = ["visibility", "conversion", "revenueCapture"];

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {components.map((id) => {
        const meta = COMPONENT_META[id];
        const value = normalized[id];
        return (
          <ScoreBar
            key={id}
            label={meta.label}
            value={value}
            color={meta.color}
            description={meta.description}
            compact={compact}
          />
        );
      })}

      {showInsight && normalized.insight?.nextAction && (
        <p className={`rounded-lg bg-[#f8f9fa] text-[#3c4043] ${compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-xs"}`}>
          <span className="font-semibold text-[#202124]">Next: </span>
          {normalized.insight.nextAction}
        </p>
      )}
    </div>
  );
}

export { COMPONENT_META };
