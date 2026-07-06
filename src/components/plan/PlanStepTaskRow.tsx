"use client";

import { useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { normalizeTextContent } from "@/lib/llm/normalize-content";
import TaskOutcomeBadge from "@/components/attribution/TaskOutcomeBadge";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import { isValidReviewId } from "@/audit/phase3/plan-task-utils";

const TYPE_LABELS: Partial<Record<ExecutionTask["type"], string>> = {
  google_post: "Google post",
  gbp_description: "Description",
  gbp_primary_category: "Primary category",
  gbp_secondary_categories: "Categories",
  gbp_services: "Service",
  gbp_photo: "Photo",
  gbp_video: "Video",
  gbp_attributes: "Attributes",
  gbp_website: "Website",
  gbp_checklist: "Checklist",
  review_response: "Review reply",
  review_delete_reply: "Remove reply",
  review_request: "Review request",
  qa_answer: "Q&A",
};

export default function PlanStepTaskRow({
  task,
  gbpConnected,
  actions,
  attribution,
  variant = "light",
}: {
  task: ExecutionTask;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  attribution?: ActionAttribution;
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.draftContent);
  const loading = actions.loadingTaskId === task.id;

  const canPublish =
    gbpConnected &&
    (task.status === "pending_approval" || task.status === "approved") &&
    task.type !== "gbp_photo" &&
    (task.type !== "review_response" || isValidReviewId(task.payload.reviewId));

  const isPhotoWithoutPreview =
    task.type === "gbp_photo" && typeof task.payload.previewDataUrl !== "string";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {TYPE_LABELS[task.type] ?? task.type}
          </p>
          <p className={`mt-0.5 text-sm font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
            {task.title.replace(/^Step \d+: /, "")}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            task.status === "completed"
              ? "bg-[#e6f4ea] text-[#137333]"
              : task.status === "pending_approval"
                ? "bg-[#fef7e0] text-[#e37400]"
                : task.status === "rejected"
                  ? "bg-[#f1f3f4] text-[#5f6368]"
                  : "bg-[#e8f0fe] text-[#1a73e8]"
          }`}
        >
          {task.status.replace(/_/g, " ")}
        </span>
      </div>

      {typeof task.payload.reviewText === "string" && task.payload.reviewText && (
        <blockquote className={`mt-3 border-l-2 pl-3 text-sm italic ${isLight ? "border-[#dadce0] text-[#5f6368]" : "border-white/20 text-slate-400"}`}>
          &ldquo;{task.payload.reviewText}&rdquo;
          {typeof task.payload.reviewAuthor === "string" && (
            <span className="not-italic"> — {task.payload.reviewAuthor}</span>
          )}
        </blockquote>
      )}

      {task.type !== "gbp_photo" && (
        <div className="mt-3">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              className={`w-full rounded-lg border p-3 text-sm ${
                isLight ? "border-[#dadce0] bg-white text-[#3c4043]" : "border-white/10 bg-slate-900 text-slate-200"
              }`}
            />
          ) : (
            <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              {normalizeTextContent(task.draftContent)}
            </p>
          )}
        </div>
      )}

      {task.result && (
        <p className={`mt-2 text-sm ${task.status === "failed" ? "text-[#d93025]" : "text-[#137333]"}`}>
          {task.status === "failed" ? "✗" : "✓"} {task.result}
        </p>
      )}

      {task.status === "completed" && <TaskOutcomeBadge attribution={attribution} />}

      {(task.status === "pending_approval" || task.status === "approved") && task.type !== "gbp_photo" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void actions.updateDraft(task.id, draft).then(() => setEditing(false));
                }}
                className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(task.draftContent);
                  setEditing(false);
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                  isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
                }`}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {canPublish && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void actions.approveAndPublish(task)}
                  className="btn-primary rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {loading ? "Publishing…" : "Approve & publish"}
                </button>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => setEditing(true)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  isLight ? "border-[#dadce0] text-[#3c4043]" : "border-white/10 text-slate-300"
                }`}
              >
                Edit
              </button>
              {task.status === "pending_approval" && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void actions.rejectTask(task.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50 ${
                    isLight ? "text-[#5f6368] hover:bg-[#f1f3f4]" : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  Skip
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!gbpConnected && task.status === "pending_approval" && task.type !== "gbp_photo" && (
        <p className={`mt-3 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          Connect Google Business Profile to publish changes.
        </p>
      )}

      {task.type === "review_response" &&
        !isValidReviewId(task.payload.reviewId) &&
        task.status !== "completed" && (
          <p className={`mt-3 text-xs ${isLight ? "text-[#c5221f]" : "text-red-400"}`}>
            Open the Reviews tab to reply to specific customers, or refresh your audit to
            regenerate review reply tasks.
          </p>
        )}

      {isPhotoWithoutPreview && task.status !== "completed" && (
        <p className={`mt-2 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
          Photo preview generating — use the photo section below when ready.
        </p>
      )}
    </div>
  );
}
