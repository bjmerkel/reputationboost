import type { ExecutionType } from "@/audit/types";

const TASK_LABELS: Partial<Record<ExecutionType, string>> = {
  google_post: "Post published",
  gbp_description: "Description updated",
  gbp_photo: "Photo uploaded",
  gbp_video: "Video uploaded",
  gbp_media_recategorize: "Photo recategorized",
  gbp_media_delete: "Photo removed",
  gbp_notifications: "Real-time alerts enabled",
  review_response: "Review reply posted",
  gbp_services: "Services updated",
  gbp_primary_category: "Category updated",
  gbp_secondary_categories: "Categories updated",
  social_post: "Social post published",
  qa_answer: "Q&A answer published",
};

function formatRank(rank: number | null): string {
  if (rank === null) return "not ranked";
  if (rank > 20) return "#20+";
  return `#${rank}`;
}

function formatDelta(value: number, label: string): string | null {
  if (value === 0) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} ${label}`;
}

export interface NarrativeInput {
  taskType: ExecutionType;
  title: string;
  publishedAt: string;
  primaryKeyword: string | null;
  rankBefore: number | null;
  rankAfter: number | null;
  callsDelta: number;
  directionsDelta: number;
  websiteClicksDelta: number;
  preliminary: boolean;
}

export function buildAttributionNarrative(input: NarrativeInput): string {
  const date = new Date(input.publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const action = TASK_LABELS[input.taskType] ?? input.title;

  const parts: string[] = [`${action} ${date}`];

  if (input.primaryKeyword && input.rankBefore !== input.rankAfter) {
    parts.push(
      `'${input.primaryKeyword}' moved ${formatRank(input.rankBefore)} → ${formatRank(input.rankAfter)}`
    );
  } else if (input.primaryKeyword) {
    parts.push(`'${input.primaryKeyword}' holding at ${formatRank(input.rankAfter)}`);
  }

  const engagement: string[] = [];
  const calls = formatDelta(input.callsDelta, "calls");
  const directions = formatDelta(input.directionsDelta, "directions");
  const clicks = formatDelta(input.websiteClicksDelta, "website clicks");
  if (calls) engagement.push(calls);
  if (directions) engagement.push(directions);
  if (clicks) engagement.push(clicks);

  if (engagement.length > 0) {
    parts.push(`→ ${engagement.join(", ")}`);
  }

  if (input.preliminary) {
    parts.push("(tracking in progress)");
  }

  return parts.join(" → ").replace(" → → ", " → ");
}
