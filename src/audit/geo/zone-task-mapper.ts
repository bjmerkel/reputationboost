import type { ExecutionTask, GapFlag } from "@/audit/types";
import type { GeoZone, ZoneAction } from "./types";

const GAP_KEYWORDS: Record<string, string[]> = {
  "unresponded-negative": ["review", "rating", "respond"],
  "stale-posts": ["post", "content", "publish"],
  "low-photo-count": ["photo", "image", "media"],
  "thin-description": ["description", "profile", "category"],
  "missing-secondary-categories": ["category", "service"],
  "low-response-rate": ["review", "respond"],
  "nap-drift": ["address", "nap"],
  "missing-local-schema": ["website", "schema"],
};

const ZONE_GAP_HINTS: Record<string, string[]> = {
  nw: ["north", "area", "service", "location"],
  ne: ["north", "east", "area", "service"],
  n: ["north", "area", "service"],
  w: ["west", "area", "service"],
  e: ["east", "area", "service"],
  sw: ["south", "west", "area"],
  se: ["south", "east", "area"],
  s: ["south", "area", "service"],
  center: ["local", "pack", "review", "profile"],
};

function textMatches(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

function gapsForZone(zone: GeoZone, gaps: GapFlag[]): GapFlag[] {
  const hints = ZONE_GAP_HINTS[zone.id] ?? ["visibility", "rank"];
  const weak = zone.severity === "weak" || zone.severity === "critical";

  return gaps
    .filter((g) => {
      if (!weak && zone.severity !== "moderate") return false;
      const gapTerms = GAP_KEYWORDS[g.id] ?? [];
      const combined = `${g.title} ${g.description}`.toLowerCase();
      return textMatches(combined, gapTerms) || textMatches(combined, hints);
    })
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 2);
}

function tasksForZone(
  zone: GeoZone,
  keyword: string,
  tasks: ExecutionTask[]
): ExecutionTask[] {
  const pending = tasks.filter(
    (t) => t.status === "pending_approval" || t.status === "approved" || t.status === "scheduled"
  );

  return pending
    .filter((t) => {
      const text = `${t.title} ${t.description}`.toLowerCase();
      return text.includes(keyword.toLowerCase()) || textMatches(text, ZONE_GAP_HINTS[zone.id] ?? []);
    })
    .slice(0, 2);
}

function defaultActionsForZone(zone: GeoZone, keyword: string): ZoneAction[] {
  if (zone.severity === "strong") return [];

  if (zone.severity === "critical") {
    return [
      {
        title: "Verify listing visibility",
        rationale: `You're not showing in search results from the ${zone.label.toLowerCase()} — check categories, NAP, and service area.`,
      },
    ];
  }

  if (zone.direction !== "center") {
    return [
      {
        title: `Target ${zone.label.toLowerCase()} in Google Posts`,
        rationale: `Publish posts and gather reviews mentioning "${keyword}" from customers in the ${zone.label.toLowerCase()} area.`,
      },
    ];
  }

  return [
    {
      title: `Boost "${keyword}" locally`,
      rationale: "Increase review velocity and post frequency to strengthen your position at your pin.",
    },
  ];
}

/** Link weak zones to existing gaps and plan tasks. */
export function mapZoneActions(
  zones: GeoZone[],
  keyword: string,
  gaps: GapFlag[] = [],
  tasks: ExecutionTask[] = []
): GeoZone[] {
  return zones.map((zone) => {
    if (zone.severity === "strong") {
      return { ...zone, recommendedActions: [] };
    }

    const actions: ZoneAction[] = [];

    for (const gap of gapsForZone(zone, gaps)) {
      actions.push({
        gapId: gap.id,
        title: gap.title,
        rationale: gap.description,
      });
    }

    for (const task of tasksForZone(zone, keyword, tasks)) {
      actions.push({
        taskId: task.id,
        title: task.title,
        rationale: task.description,
      });
    }

    if (actions.length === 0) {
      actions.push(...defaultActionsForZone(zone, keyword));
    }

    return { ...zone, recommendedActions: actions.slice(0, 3) };
  });
}
