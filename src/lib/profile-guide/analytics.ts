import type {
  ProfileGuideAnalyticsPeriod,
  ProfileGuideAnalyticsSummary,
  ProfileGuideLinkType,
  ProfileGuideSourceStats,
} from "./types";

export function formatSourceLabel(source: string): string {
  switch (source) {
    case "qr":
      return "QR code";
    case "direct":
      return "Direct link";
    case "outreach":
      return "Review outreach";
    case "preview":
      return "Preview";
    default:
      return source.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function buildAnalyticsNarrative(input: {
  periodDays: ProfileGuideAnalyticsPeriod;
  totalViews: number;
  topLink: { label: string; clicks: number } | null;
  topSource: ProfileGuideSourceStats | null;
  attributedReviews: number;
}): string {
  if (input.totalViews === 0) {
    return `Your Profile Guide has not received any visits in the last ${input.periodDays} days yet. Share your QR code to get started.`;
  }

  const periodLabel =
    input.periodDays === 7
      ? "this week"
      : input.periodDays === 30
        ? "this month"
        : "the last 90 days";

  const parts: string[] = [
    `Your Profile Guide received ${input.totalViews} visit${input.totalViews === 1 ? "" : "s"} ${periodLabel}.`,
  ];

  if (input.topLink) {
    parts.push(`The ${input.topLink.label} button was the most frequently clicked.`);
  }

  if (input.topSource && input.topSource.views > 0) {
    parts.push(`Most traffic came from ${formatSourceLabel(input.topSource.source).toLowerCase()}.`);
  }

  if (input.attributedReviews > 0) {
    parts.push(
      `${input.attributedReviews} Google review${input.attributedReviews === 1 ? "" : "s"} were attributed to your guide.`
    );
  }

  return parts.join(" ");
}

export function summarizeProfileGuideAnalytics(
  periodDays: ProfileGuideAnalyticsPeriod,
  raw: {
    totalViews: number;
    totalClicks: number;
    linkClicks: Array<{ link_id: string | null; label: string; link_type: string; clicks: number }>;
    sourceBreakdown: ProfileGuideSourceStats[];
    viewsByDay: Array<{ date: string; views: number }>;
    attributedReviews: number;
  }
): ProfileGuideAnalyticsSummary {
  const top = raw.linkClicks[0]
    ? { id: raw.linkClicks[0].link_id!, label: raw.linkClicks[0].label, clicks: raw.linkClicks[0].clicks }
    : null;

  const topSource = [...raw.sourceBreakdown].sort((a, b) => b.views - a.views)[0] ?? null;

  return {
    periodDays,
    totalViews: raw.totalViews,
    totalClicks: raw.totalClicks,
    topLink: top,
    linkClicks: raw.linkClicks.map((row) => ({
      id: row.link_id!,
      label: row.label,
      linkType: row.link_type as ProfileGuideLinkType,
      clicks: row.clicks,
    })),
    sourceBreakdown: raw.sourceBreakdown,
    viewsByDay: raw.viewsByDay,
    attributedReviews: raw.attributedReviews,
    narrative: buildAnalyticsNarrative({
      periodDays,
      totalViews: raw.totalViews,
      topLink: top,
      topSource,
      attributedReviews: raw.attributedReviews,
    }),
  };
}
