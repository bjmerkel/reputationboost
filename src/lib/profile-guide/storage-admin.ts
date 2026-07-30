import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileGuideEventType } from "./types";

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

export async function getProfileGuideAnalyticsAdmin(
  guideId: string,
  periodDays: 7 | 30 | 90
): Promise<{
  totalViews: number;
  totalClicks: number;
  linkClicks: Array<{ link_id: string | null; label: string; link_type: string; clicks: number }>;
  viewsByDay: Array<{ date: string; views: number }>;
}> {
  const supabase = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const { data: events, error } = await supabase
    .from("profile_guide_events")
    .select("event_type, link_id, occurred_at")
    .eq("guide_id", guideId)
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: true });

  if (error) throw new Error(error.message);

  const { data: links, error: linksError } = await supabase
    .from("profile_guide_links")
    .select("id, label, link_type")
    .eq("guide_id", guideId);

  if (linksError) throw new Error(linksError.message);

  const linkMeta = new Map(
    (links ?? []).map((link) => [link.id as string, { label: link.label as string, link_type: link.link_type as string }])
  );

  let totalViews = 0;
  let totalClicks = 0;
  const clicksByLink = new Map<string, number>();
  const viewsByDay = new Map<string, number>();

  for (const event of events ?? []) {
    const type = event.event_type as string;
    const day = (event.occurred_at as string).slice(0, 10);

    if (type === "view") {
      totalViews += 1;
      viewsByDay.set(day, (viewsByDay.get(day) ?? 0) + 1);
    } else if (type === "click") {
      totalClicks += 1;
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

  return {
    totalViews,
    totalClicks,
    linkClicks,
    viewsByDay: [...viewsByDay.entries()].map(([date, views]) => ({ date, views })),
  };
}
