import type {
  ProfileGuideAnalyticsPeriod,
  ProfileGuideAnalyticsSummary,
  ProfileGuideLinkType,
} from "./types";

export function buildAnalyticsNarrative(input: {
  periodDays: ProfileGuideAnalyticsPeriod;
  totalViews: number;
  topLink: { label: string; clicks: number } | null;
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

  if (input.topLink) {
    return `Your Profile Guide received ${input.totalViews} visit${input.totalViews === 1 ? "" : "s"} ${periodLabel}. The ${input.topLink.label} button was the most frequently clicked.`;
  }

  return `Your Profile Guide received ${input.totalViews} visit${input.totalViews === 1 ? "" : "s"} ${periodLabel}.`;
}

export function summarizeProfileGuideAnalytics(
  periodDays: ProfileGuideAnalyticsPeriod,
  raw: {
    totalViews: number;
    totalClicks: number;
    linkClicks: Array<{ link_id: string | null; label: string; link_type: string; clicks: number }>;
    viewsByDay: Array<{ date: string; views: number }>;
  }
): ProfileGuideAnalyticsSummary {
  const top = raw.linkClicks[0]
    ? { id: raw.linkClicks[0].link_id!, label: raw.linkClicks[0].label, clicks: raw.linkClicks[0].clicks }
    : null;

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
    viewsByDay: raw.viewsByDay,
    narrative: buildAnalyticsNarrative({
      periodDays,
      totalViews: raw.totalViews,
      topLink: top,
    }),
  };
}
