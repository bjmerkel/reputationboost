"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import {
  POLICY_VIOLATION_LABELS,
  REVIEW_DISPUTE_POLICY_VIOLATIONS,
  type DisputeCandidate,
  type ReviewDisputePolicyViolation,
  type ReviewDisputeRecord,
} from "@/lib/review-disputes/types";

interface ReviewDisputePanelProps {
  tasks: ExecutionTask[];
  actions: PlanTaskActions;
  projectedStepGain?: number;
  variant?: "light" | "dark";
  onDisputeUpdated?: () => void;
}

export default function ReviewDisputePanel({
  tasks,
  actions,
  projectedStepGain,
  variant = "light",
  onDisputeUpdated,
}: ReviewDisputePanelProps) {
  const isLight = variant === "light";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DisputeCandidate[]>([]);
  const [disputes, setDisputes] = useState<ReviewDisputeRecord[]>([]);
  const [reportUrl, setReportUrl] = useState("https://business.google.com/reviews");
  const [projectedOverallGain, setProjectedOverallGain] = useState(0);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [policyViolation, setPolicyViolation] = useState<ReviewDisputePolicyViolation>("fake_content");
  const [saving, setSaving] = useState(false);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review-disputes");
      const data = await parseJsonResponse<{
        candidates: DisputeCandidate[];
        disputes: ReviewDisputeRecord[];
        reportUrl: string;
        projectedOverallGain: number;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load disputes");
      setCandidates(data.candidates);
      setDisputes(data.disputes);
      setReportUrl(data.reportUrl);
      setProjectedOverallGain(data.projectedOverallGain);
      if (!activeReviewId && data.candidates[0]) {
        selectCandidate(data.candidates[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, [activeReviewId]);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  function selectCandidate(candidate: DisputeCandidate) {
    setActiveReviewId(candidate.reviewId);
    setEvidenceNotes(candidate.evidenceTemplate);
    setPolicyViolation(candidate.suggestedViolation);
  }

  const activeCandidate =
    candidates.find((c) => c.reviewId === activeReviewId) ??
    candidates[0] ??
    null;
  const activeTask = tasks.find(
    (t) => String(t.payload.reviewId) === (activeCandidate?.reviewId ?? activeReviewId)
  );
  const activeDispute = disputes.find(
    (d) => d.reviewId === (activeCandidate?.reviewId ?? activeReviewId ?? "")
  );

  async function handleFlag(status: "flagged" | "submitted") {
    if (!activeCandidate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/review-disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: activeCandidate.reviewId,
          policyViolation,
          evidenceNotes,
          reviewerName: activeCandidate.author,
          reviewRating: activeCandidate.rating,
          reviewText: activeCandidate.text,
          reviewPublishedAt: activeCandidate.publishedAt,
          executionTaskId: activeTask?.id,
          projectedScoreGain: activeCandidate.projectedScoreGain,
          status,
        }),
      });
      const data = await parseJsonResponse<{ dispute: ReviewDisputeRecord; reportUrl: string; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to save dispute");

      if (activeTask && status === "submitted") {
        await actions.approveAndPublish(activeTask, { draftContent: evidenceNotes, payload: { policyViolation } });
      } else if (activeTask) {
        await actions.updateDraft(activeTask.id, evidenceNotes);
      }

      setReportUrl(data.reportUrl);
      await loadDisputes();
      onDisputeUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save dispute");
    } finally {
      setSaving(false);
    }
  }

  async function handleResolution(status: "removed" | "declined") {
    if (!activeDispute) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/review-disputes/${activeDispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolutionNotes: status === "removed" ? "Review removed by Google" : "Google declined removal" }),
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to update dispute");
      await loadDisputes();
      onDisputeUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dispute");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className={`text-sm ${isLight ? "text-[#80868b]" : "text-slate-400"}`}>
        Loading dispute candidates…
      </p>
    );
  }

  if (candidates.length === 0 && disputes.length === 0) {
    return (
      <div className={`rounded-lg border p-4 ${isLight ? "border-[#ceead6] bg-[#f6faf7]" : "border-emerald-500/20 bg-emerald-500/5"}`}>
        <p className={`text-sm font-medium ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
          No dispute candidates right now
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Low-star reviews that look policy-violating will appear here with evidence templates and score impact.
        </p>
      </div>
    );
  }

  const gainLabel = projectedStepGain ?? projectedOverallGain;

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 ${isLight ? "border-[#d2e3fc] bg-[#f8fbff]" : "border-cyan-500/20 bg-cyan-500/5"}`}>
        <p className={`text-sm font-semibold ${isLight ? "text-[#1967d2]" : "text-cyan-300"}`}>
          Dispute workflow
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          Google has no public dispute API — we pre-classify violations, draft evidence, and track outcomes.
          {gainLabel > 0 ? ` Successful removals could add +${gainLabel} to your Reputation Boost Score.` : ""}
        </p>
        <ol className={`mt-3 list-decimal space-y-1 pl-5 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
          <li>Review the flagged candidate and edit evidence</li>
          <li>Flag for your records, or mark submitted after filing in Google</li>
          <li>Record the outcome when Google responds</li>
        </ol>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          {candidates.map((candidate) => {
            const selected = candidate.reviewId === (activeCandidate?.reviewId ?? "");
            const existing = disputes.find((d) => d.reviewId === candidate.reviewId);
            return (
              <button
                key={candidate.reviewId}
                type="button"
                onClick={() => selectCandidate(candidate)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? isLight
                      ? "border-[#1967d2] bg-[#e8f0fe]"
                      : "border-cyan-400/40 bg-cyan-500/10"
                    : isLight
                      ? "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{candidate.rating}★</span>
                  {candidate.projectedScoreGain > 0 && (
                    <span className={`text-xs ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
                      +{candidate.projectedScoreGain} pts
                    </span>
                  )}
                </div>
                <p className={`mt-1 truncate ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                  {candidate.author}
                </p>
                {existing && (
                  <p className={`mt-1 text-xs capitalize ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                    {existing.status.replace("_", " ")}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {activeCandidate && (
          <div className={`rounded-lg border p-4 ${isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-white/[0.02]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                  {activeCandidate.rating}★ · {activeCandidate.author}
                </p>
                <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                  {activeCandidate.violationReason}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  activeCandidate.violationConfidence === "high"
                    ? "bg-red-100 text-red-700"
                    : activeCandidate.violationConfidence === "medium"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {activeCandidate.violationConfidence} confidence
              </span>
            </div>

            <blockquote className={`mt-3 rounded-lg p-3 text-sm italic ${isLight ? "bg-[#f8f9fa] text-[#3c4043]" : "bg-white/5 text-slate-300"}`}>
              {activeCandidate.text || "(No review text)"}
            </blockquote>

            <label className={`mt-4 block text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
              Policy violation
            </label>
            <select
              value={policyViolation}
              onChange={(e) => setPolicyViolation(e.target.value as ReviewDisputePolicyViolation)}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                isLight ? "border-[#dadce0] bg-white text-[#202124]" : "border-white/10 bg-white/5 text-white"
              }`}
            >
              {REVIEW_DISPUTE_POLICY_VIOLATIONS.map((violation) => (
                <option key={violation} value={violation}>
                  {POLICY_VIOLATION_LABELS[violation]}
                </option>
              ))}
            </select>

            <label className={`mt-4 block text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
              Evidence template
            </label>
            <textarea
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
              rows={12}
              className={`mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs ${
                isLight ? "border-[#dadce0] bg-white text-[#202124]" : "border-white/10 bg-white/5 text-white"
              }`}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleFlag("flagged")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  isLight
                    ? "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
                    : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleFlag("submitted")}
                className="rounded-lg bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1765cc] disabled:opacity-60"
              >
                Mark submitted
              </button>
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  isLight
                    ? "border border-[#d2e3fc] bg-[#e8f0fe] text-[#1967d2]"
                    : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                }`}
              >
                Open in Google ↗
              </a>
            </div>

            {activeDispute && ["submitted", "under_review"].includes(activeDispute.status) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed pt-4">
                <p className={`w-full text-xs font-semibold uppercase ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                  Record Google&apos;s decision
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleResolution("removed")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Review removed
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleResolution("declined")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isLight ? "border border-[#dadce0] text-[#3c4043]" : "border border-white/10 text-slate-300"
                  }`}
                >
                  Google declined
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
