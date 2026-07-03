import type { HealthScores } from "@/audit/types";

const DRIVER_META = {
  label: "Profile strength",
  description: "Controllable signals — relevance, reviews, content",
  color: "#007b83",
};

const OUTCOME_META = {
  label: "Ranking outcome",
  description: "Where you rank today — visibility + click share",
  color: "#1a73e8",
};

const OUTCOME_DETAIL = {
  visibility: {
    label: "Visibility",
    color: "#1a73e8",
  },
  revenueCapture: {
    label: "Revenue capture",
    color: "#188038",
  },
};

export function normalizeHealthScores(scores: HealthScores | undefined | null): HealthScores | null {
  if (!scores) return null;

  const driverScore = scores.driverScore ?? scores.conversion ?? 0;
  const outcomeIndex =
    scores.outcomeIndex ??
    Math.round((scores.visibility ?? 0) * 0.6 + (scores.revenueCapture ?? 0) * 0.4);

  if (
    Number.isFinite(scores.visibility) &&
    Number.isFinite(scores.conversion) &&
    Number.isFinite(scores.revenueCapture)
  ) {
    return {
      ...scores,
      driverScore,
      outcomeIndex,
    };
  }

  return {
    ...scores,
    driverScore,
    outcomeIndex,
    visibility: scores.localPackCoverage ?? scores.visibility ?? 0,
    conversion: scores.reviewStrength ?? scores.conversion ?? 0,
    revenueCapture: scores.competitiveGap ?? scores.revenueCapture ?? 0,
    insight: scores.insight ?? {
      weakestComponent: "conversion",
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

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <ScoreBar
        label={DRIVER_META.label}
        value={normalized.driverScore}
        color={DRIVER_META.color}
        description={DRIVER_META.description}
        compact={compact}
      />

      <div>
        <ScoreBar
          label={OUTCOME_META.label}
          value={normalized.outcomeIndex}
          color={OUTCOME_META.color}
          description={OUTCOME_META.description}
          compact={compact}
        />
        {!compact && (
          <div className="mt-2 space-y-1.5 border-l-2 border-[#e8eaed] pl-3">
            <ScoreBar
              label={OUTCOME_DETAIL.visibility.label}
              value={normalized.visibility}
              color={OUTCOME_DETAIL.visibility.color}
              compact
            />
            <ScoreBar
              label={OUTCOME_DETAIL.revenueCapture.label}
              value={normalized.revenueCapture}
              color={OUTCOME_DETAIL.revenueCapture.color}
              compact
            />
          </div>
        )}
      </div>

      {showInsight && normalized.insight?.nextAction && (
        <p className={`rounded-lg bg-[#f8f9fa] text-[#3c4043] ${compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-xs"}`}>
          <span className="font-semibold text-[#202124]">Next: </span>
          {normalized.insight.nextAction}
        </p>
      )}
    </div>
  );
}

export { DRIVER_META, OUTCOME_META };
