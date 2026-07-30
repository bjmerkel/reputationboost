import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileGuideEventType, ProfileGuideSourceStats } from "./types";

export async function recordProfileGuideEventAdmin(input: {
  guideId: string;
  linkId?: string | null;
  eventType: ProfileGuideEventType;
  source?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("profile_guide_events").insert({
    guide_id: input.guideId,
    link_id: input.linkId ?? null,
    event_type: input.eventType,
    source: input.source ?? null,
    referrer: input.referrer ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) throw new Error(error.message);
}

function normalizeSource(source: string | null | undefined): string {
  const value = source?.trim();
  return value || "direct";
}

export async function getProfileGuideAnalyticsAdmin(
  guideId: string,
  periodDays: 7 | 30 | 90
): Promise<{
  totalViews: number;
  totalClicks: number;
  linkClicks: Array<{ link_id: string | null; label: string; link_type: string; clicks: number }>;
  sourceBreakdown: ProfileGuideSourceStats[];
  viewsByDay: Array<{ date: string; views: number }>;
  attributedReviews: number;
}> {
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const { data: events, error } = await supabase
    .from("profile_guide_events")
    .select("event_type, link_id, source, occurred_at")
    .eq("guide_id", guideId)
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: true });

  if (error) throw new Error(error.message);

  const { data: links, error: linksError } = await supabase
    .from("profile_guide_links")
    .select("id, label, link_type")
    .eq("guide_id", guideId);

  if (linksError) throw new Error(linksError.message);

  const { count: attributedReviews, error: attributionError } = await supabase
    .from("review_outreach_attributions")
    .select("id", { count: "exact", head: true })
    .eq("profile_guide_id", guideId)
    .gte("review_detected_at", since.toISOString());

  if (attributionError && !attributionError.message.includes("profile_guide_id")) {
    throw new Error(attributionError.message);
  }

  const linkMeta = new Map(
    (links ?? []).map((link) => [
      link.id as string,
      { label: link.label as string, link_type: link.link_type as string },
    ])
  );

  let totalViews = 0;
  let totalClicks = 0;
  const clicksByLink = new Map<string, number>();
  const viewsByDay = new Map<string, number>();
  const sourceStats = new Map<string, { views: number; clicks: number }>();

  for (const event of events ?? []) {
    const type = event.event_type as string;
    const day = (event.occurred_at as string).slice(0, 10);
    const source = normalizeSource(event.source as string | null);

    if (!sourceStats.has(source)) {
      sourceStats.set(source, { views: 0, clicks: 0 });
    }
    const stats = sourceStats.get(source)!;

    if (type === "view") {
      totalViews += 1;
      stats.views += 1;
      viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + 1);
    } else if (type === "click") {
      totalClicks += 1;
      stats.clicks += 1;
      const linkId = event.link_id as string | null;
      if (linkId) {
        clicksByLink.set(linkId, (clicksByLink.get(linkId) ?? 0) + 1);
      }
    }
  }

  const linkClicks = [...clicksByLink.entries()].map(([linkId, clicks]) => {
    const meta = linkMeta.get(linkId);
    return {
      link_id: linkId,
      label: meta?.label ?? "Unknown",
      link_type: meta?.link_type ?? "custom",
      clicks,
    };
  });

  linkClicks.sort((a, b) => b.clicks - a.clicks);

  const sourceBreakdown: ProfileGuideSourceStats[] = [...sourceStats.entries()]
    .map(([source, stats]) => ({ source, views: stats.views, clicks: stats.clicks }))
    .sort((a, b) => b.views - a.views);

  return {
    totalViews,
    totalClicks,
    linkClicks,
    sourceBreakdown,
    viewsByDay: [...viewsByDay.entries()].map(([date, views]) => ({ date, views })),
    attributedReviews: attributedReviews ?? 0,
  };
}

export async function findRecentProfileGuideReviewClick(
  guideId: string,
  beforeIso: string,
  windowDays: number
): Promise<{ linkId: string; occurredAt: string } | null> {
  const supabase = createAdminClient();
  const windowStart = new Date(beforeIso);
  windowStart.setDate(windowStart.getDate() - windowDays);

  const { data: reviewLink } = await supabase
    .from("profile_guide_links")
    .select("id")
    .eq("guide_id", guideId)
    .eq("link_type", "review")
    .maybeSingle();

  if (!reviewLink?.id) return null;

  const { data, error } = await supabase
    .from("profile_guide_events")
    .select("link_id, occurred_at")
    .eq("guide_id", guideId)
    .eq("link_id", reviewLink.id)
    .eq("event_type", "click")
    .gte("occurred_at", windowStart.toISOString())
    .lte("occurred_at", beforeIso)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.link_id) return null;

  return {
    linkId: data.link_id as string,
    occurredAt: data.occurred_at as string,
  };
}

export async function listProfileGuideAttributionsBetween(
  businessId: string,
  startIso: string,
  endIso: string
): Promise<Array<{ reviewDetectedAt: string; reviewRating: number | null }>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("review_outreach_attributions")
    .select("review_detected_at, review_rating")
    .eq("business_id", businessId)
    .not("profile_guide_id", "is", null)
    .gte("review_detected_at", startIso)
    .lte("review_detected_at", endIso)
    .order("review_detected_at", { ascending: false });

  if (error) {
    if (error.message.includes("profile_guide_id")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    reviewDetectedAt: row.review_detected_at as string,
    reviewRating: (row.review_rating as number | null) ?? null,
  }));
}
