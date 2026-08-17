"use client";

import { usePreviewAudit } from "@/context/PreviewAuditContext";

function formatLastNightlyUpdate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(2, 14, 0, 0);
  return d.toLocaleString(undefined, {
    weekday: undefined,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PlatformActivityFeed() {
  const { preview, isLive, loading } = usePreviewAudit();

  if (loading || !isLive || !preview) {
    return null;
  }

  const topKeyword = preview.keywords[0];
  const topAction = preview.pathToHealthy.topActions[0];
  const scoreGain = preview.pathToHealthy.projectedScore - preview.score.overall;
  const recentReviews = preview.platformAudit.gbp.engagement.reviewsLast30Days;

  const items: Array<{ type: "success" | "next"; text: string }> = [];

  if (topKeyword) {
    if (topKeyword.inLocalPack) {
      items.push({
        type: "success",
        text: `In Local 3-Pack for "${topKeyword.keyword}"`,
      });
    } else if (topKeyword.rank != null) {
      items.push({
        type: "success",
        text: `Tracking ranking #${topKeyword.rank} for "${topKeyword.keyword}"`,
      });
    } else {
      items.push({
        type: "success",
        text: `Monitoring "${topKeyword.keyword}" across your service area`,
      });
    }
  }

  if (recentReviews > 0) {
    items.push({
      type: "success",
      text: `Added ${Math.min(recentReviews, 9)} new review${recentReviews === 1 ? "" : "s"}`,
    });
  }

  if (scoreGain > 0) {
    items.push({
      type: "success",
      text: `Up to ${scoreGain} point score opportunity identified`,
    });
  }

  if (topAction) {
    items.push({
      type: "next",
      text: `Next recommendation: ${topAction.title}`,
    });
  } else if (preview.topGap) {
    items.push({
      type: "next",
      text: `Next recommendation: ${preview.topGap.title}`,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-[#dadce0] bg-[#f8f9fa] px-4 py-5">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
          Last update · {formatLastNightlyUpdate()}
        </p>
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.text} className="flex items-start gap-2 text-sm text-[#3c4043]">
              <span className={item.type === "success" ? "text-[#188038]" : "text-[#1a73e8]"}>
                {item.type === "success" ? "✓" : "→"}
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
