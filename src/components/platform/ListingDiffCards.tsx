"use client";

import { useState } from "react";
import type { ExecutionTask, ExecutionType, FullAuditPayload } from "@/audit/types";
import { normalizeTextContent } from "@/lib/llm/normalize-content";

const LISTING_DIFF_TYPES: ExecutionType[] = [
  "gbp_description",
  "gbp_services",
  "gbp_primary_category",
  "gbp_secondary_categories",
  "gbp_attributes",
  "gbp_website",
  "google_post",
];

const FIELD_LABELS: Partial<Record<ExecutionType, string>> = {
  gbp_description: "Description",
  gbp_services: "Services",
  gbp_primary_category: "Primary category",
  gbp_secondary_categories: "Categories",
  gbp_attributes: "Attributes",
  gbp_website: "Website",
  google_post: "Google post",
};

interface ListingDiffCardsProps {
  audit: FullAuditPayload;
  clientId: string;
  auditId: string;
  tasks: ExecutionTask[];
  onViewAll: () => void;
}

export default function ListingDiffCards({
  audit,
  clientId,
  auditId,
  tasks,
  onViewAll,
}: ListingDiffCardsProps) {
  const [localTasks, setLocalTasks] = useState(tasks);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const profileTasks = localTasks.filter(
    (t) =>
      t.status === "pending_approval" && LISTING_DIFF_TYPES.includes(t.type)
  );

  const otherPending = localTasks.filter(
    (t) =>
      t.status === "pending_approval" && !LISTING_DIFF_TYPES.includes(t.type)
  ).length;

  if (profileTasks.length === 0 && otherPending === 0) return null;

  async function approve(taskId: string) {
    setLoadingId(taskId);
    try {
      const res = await fetch(`/api/execution/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (!res.ok) return;
      const listRes = await fetch(`/api/execution?clientId=${clientId}&auditId=${auditId}`);
      const data = await listRes.json();
      if (listRes.ok) setLocalTasks(data.tasks);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[#202124]">Listing improvements</h3>
        {(otherPending > 0 || profileTasks.length > 3) && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-[#1a73e8] hover:underline"
          >
            View all updates
          </button>
        )}
      </div>

      {profileTasks.slice(0, 4).map((task) => (
        <article
          key={task.id}
          className="rounded-lg border border-[#dadce0] bg-white p-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-[#202124]">
              {FIELD_LABELS[task.type] ?? task.title}
            </p>
            <span className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-medium text-[#e37400]">
              Fix
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <DiffBlock
              label="Current"
              content={getCurrentValue(audit, task.type)}
              variant="current"
            />
            <DiffBlock
              label="Suggested"
              content={normalizeTextContent(task.draftContent)}
              variant="suggested"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={loadingId === task.id}
              onClick={() => approve(task.id)}
              className="rounded-full bg-[#1a73e8] px-3 py-1 text-xs font-medium text-white hover:bg-[#1765cc] disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-full border border-[#dadce0] px-3 py-1 text-xs font-medium text-[#3c4043] hover:bg-[#f1f3f4]"
            >
              Edit in Updates
            </button>
          </div>
        </article>
      ))}

      {otherPending > 0 && (
        <button
          type="button"
          onClick={onViewAll}
          className="w-full rounded-lg border border-dashed border-[#dadce0] py-2 text-xs font-medium text-[#1a73e8] hover:bg-[#f8f9fa]"
        >
          + {otherPending} more update{otherPending === 1 ? "" : "s"} (reviews, posts, etc.)
        </button>
      )}
    </section>
  );
}

function DiffBlock({
  label,
  content,
  variant,
}: {
  label: string;
  content: string;
  variant: "current" | "suggested";
}) {
  const isSuggested = variant === "suggested";
  return (
    <div
      className={`rounded-md px-3 py-2 text-xs ${
        isSuggested
          ? "border border-[#ceead6] bg-[#e6f4ea] text-[#137333]"
          : "border border-[#dadce0] bg-[#f8f9fa] text-[#5f6368]"
      }`}
    >
      <p className="mb-0.5 font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="line-clamp-4 whitespace-pre-wrap leading-relaxed">{content || "—"}</p>
    </div>
  );
}

function getCurrentValue(audit: FullAuditPayload, type: ExecutionType): string {
  const { gbp } = audit;
  const live = gbp.liveProfile;

  switch (type) {
    case "gbp_description":
      return live?.description || "(No description on Google)";
    case "gbp_services":
      return live?.services?.length
        ? live.services.map((s) => s.name).join(", ")
        : gbp.completeness.serviceCount
          ? `${gbp.completeness.serviceCount} services listed`
          : "(No services listed)";
    case "gbp_primary_category":
      return gbp.identity.primaryCategory || live?.primaryCategory || "—";
    case "gbp_secondary_categories":
      return (
        live?.secondaryCategories?.join(", ") ||
        gbp.identity.secondaryCategories?.join(", ") ||
        "—"
      );
    case "gbp_attributes":
      return live?.attributes?.join(", ") || "—";
    case "gbp_website":
      return gbp.identity.website || "—";
    case "google_post":
      return gbp.recentPosts?.[0]?.summary || "(No recent posts)";
    default:
      return "—";
  }
}

/** Merge pending drafts into a customer-facing preview. */
export function getOptimizedPreview(audit: FullAuditPayload, tasks: ExecutionTask[]) {
  const descriptionTask = tasks.find(
    (t) => t.type === "gbp_description" && t.status === "pending_approval"
  );
  const postTask = tasks.find(
    (t) => t.type === "google_post" && t.status === "pending_approval"
  );

  return {
    description:
      descriptionTask?.draftContent?.trim() ||
      audit.gbp.liveProfile?.description ||
      "",
    recentPost: postTask?.draftContent?.trim() || audit.gbp.recentPosts?.[0]?.summary || "",
  };
}
