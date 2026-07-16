"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExecutionTask } from "@/audit/types";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import {
  POLICY_VIOLATION_DESCRIPTIONS,
  POLICY_VIOLATION_LABELS,
  REVIEW_DISPUTE_POLICY_VIOLATIONS,
  type DisputeCandidate,
  type ReviewDisputePolicyViolation,
  type ReviewDisputeRecord,
  type ReviewDisputeStatus,
} from "@/lib/review-disputes/types";

interface ReviewDisputePanelProps {
  tasks: ExecutionTask[];
  actions: PlanTaskActions;
  projectedStepGain?: number;
  variant?: "light" | "dark";
  onDisputeUpdated?: () => void;
}

const WORKFLOW_STEPS = [
  { title: "Reviews tab", detail: "Click on the Reviews tab" },
  { title: "Find the review", detail: "Search the review using the search magnifying glass" },
  { title: "Report review", detail: "Click the 3 dots and press Report review" },
  { title: "Policy violation", detail: "Select the policy violation type we recommended" },
  { title: "Submit", detail: "Press Submit" },
] as const;

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(status: ReviewDisputeStatus): string {
  return status.replace(/_/g, " ");
}

function confidenceStyles(confidence: DisputeCandidate["violationConfidence"], isLight: boolean) {
  if (confidence === "high") {
    return isLight ? "bg-red-50 text-red-800 ring-red-200" : "bg-red-500/15 text-red-300 ring-red-500/30";
  }
  if (confidence === "medium") {
    return isLight ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  }
  return isLight ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-white/10 text-slate-300 ring-white/10";
}

function disputeStatusStyles(status: ReviewDisputeStatus, isLight: boolean): string {
  if (status === "removed") {
    return isLight ? "bg-emerald-50 text-emerald-800" : "bg-emerald-500/15 text-emerald-300";
  }
  if (status === "submitted" || status === "under_review") {
    return isLight ? "bg-blue-50 text-blue-800" : "bg-blue-500/15 text-blue-300";
  }
  if (status === "declined") {
    return isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-slate-400";
  }
  return isLight ? "bg-amber-50 text-amber-900" : "bg-amber-500/15 text-amber-200";
}

function StarRating({ rating, isLight }: { rating: number; isLight: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-base font-semibold ${isLight ? "text-[#ea8600]" : "text-amber-400"}`} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
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
  const [policyViolation, setPolicyViolation] = useState<ReviewDisputePolicyViolation>("low_quality_information");
  const [saving, setSaving] = useState(false);

  const applyCandidate = useCallback((candidate: DisputeCandidate) => {
    setActiveReviewId(candidate.reviewId);
    setEvidenceNotes(candidate.evidenceTemplate);
    setPolicyViolation(candidate.suggestedViolation);
  }, []);

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

      setActiveReviewId((prev) => {
        const nextId =
          prev && data.candidates.some((c) => c.reviewId === prev)
            ? prev
            : data.candidates[0]?.reviewId ?? null;
        const nextCandidate = data.candidates.find((c) => c.reviewId === nextId);
        if (nextCandidate && nextId !== prev) {
          setEvidenceNotes(nextCandidate.evidenceTemplate);
          setPolicyViolation(nextCandidate.suggestedViolation);
        }
        return nextId;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  const activeCandidate =
    candidates.find((c) => c.reviewId === activeReviewId) ?? candidates[0] ?? null;
  const activeTask = tasks.find(
    (t) => String(t.payload.reviewId) === (activeCandidate?.reviewId ?? activeReviewId)
  );
  const activeDispute = disputes.find(
    (d) => d.reviewId === (activeCandidate?.reviewId ?? activeReviewId ?? "")
  );

  const gainLabel = projectedStepGain ?? projectedOverallGain;
  const pendingCount = candidates.length;
  const trackedCount = disputes.filter((d) => d.status !== "removed" && d.status !== "declined").length;

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
        body: JSON.stringify({
          status,
          resolutionNotes: status === "removed" ? "Review removed by Google" : "Google declined removal",
        }),
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

  const shell = isLight
    ? "rounded-2xl border border-[#dadce0] bg-white shadow-sm"
    : "rounded-2xl border border-white/10 bg-white/[0.02]";

  if (loading) {
    return (
      <div className={`${shell} p-8`}>
        <div className="animate-pulse space-y-4">
          <div className={`h-4 w-48 rounded ${isLight ? "bg-[#e8eaed]" : "bg-white/10"}`} />
          <div className={`h-24 rounded-xl ${isLight ? "bg-[#f1f3f4]" : "bg-white/5"}`} />
          <div className={`h-64 rounded-xl ${isLight ? "bg-[#f1f3f4]" : "bg-white/5"}`} />
        </div>
      </div>
    );
  }

  if (candidates.length === 0 && disputes.length === 0) {
    return (
      <div className={`${shell} p-8 text-center`}>
        <p className={`text-lg font-semibold ${isLight ? "text-[#137333]" : "text-emerald-300"}`}>
          No dispute candidates right now
        </p>
        <p className={`mx-auto mt-2 max-w-md text-sm leading-relaxed ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          When we detect low-star reviews that may violate Google&apos;s policies, they&apos;ll appear here with evidence templates and score impact estimates.
        </p>
      </div>
    );
  }

  return (
    <div className={`${shell} overflow-hidden`}>
      {/* Header */}
      <div className={`border-b px-6 py-5 ${isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#1a73e8]" : "text-cyan-300"}`}>
              Dispute illegitimate reviews
            </p>
            <p className={`mt-1 max-w-2xl text-sm leading-relaxed ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              Flag policy-violating reviews, file them in Google Business Profile, and track outcomes. Google has no public dispute API — we guide you through the manual process.
            </p>
          </div>
          {gainLabel > 0 && (
            <div
              className={`shrink-0 rounded-xl px-4 py-3 text-center ${
                isLight ? "bg-[#ceead6] text-[#137333]" : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">Potential gain</p>
              <p className="mt-0.5 text-2xl font-bold">+{gainLabel}</p>
              <p className="text-xs opacity-80">Reputation Boost pts</p>
            </div>
          )}
        </div>

        <dl className={`mt-5 grid gap-3 sm:grid-cols-3 ${isLight ? "text-[#202124]" : "text-slate-100"}`}>
          <div className={`rounded-xl border px-4 py-3 ${isLight ? "border-[#e8eaed] bg-white" : "border-white/10 bg-white/[0.02]"}`}>
            <dt className={`text-xs font-medium ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>Candidates</dt>
            <dd className="mt-1 text-2xl font-semibold">{pendingCount}</dd>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${isLight ? "border-[#e8eaed] bg-white" : "border-white/10 bg-white/[0.02]"}`}>
            <dt className={`text-xs font-medium ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>In progress</dt>
            <dd className="mt-1 text-2xl font-semibold">{trackedCount}</dd>
          </div>
          <div className={`rounded-xl border px-4 py-3 ${isLight ? "border-[#e8eaed] bg-white" : "border-white/10 bg-white/[0.02]"}`}>
            <dt className={`text-xs font-medium ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>Per-review gain</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {activeCandidate?.projectedScoreGain ? `+${activeCandidate.projectedScoreGain}` : "—"}
            </dd>
          </div>
        </dl>

        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {WORKFLOW_STEPS.map((step, index) => (
            <li
              key={step.title}
              className={`rounded-xl border px-4 py-3 ${
                isLight ? "border-[#e8eaed] bg-white" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                Step {index + 1}
              </p>
              <p className={`mt-1 text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>{step.title}</p>
              <p className={`mt-0.5 text-xs leading-relaxed ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <div className={`mx-6 mt-5 rounded-xl border px-4 py-3 text-sm ${isLight ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {error}
        </div>
      )}

      {/* Candidate picker */}
      <div className={`border-b px-6 py-5 ${isLight ? "border-[#e8eaed]" : "border-white/10"}`}>
        <div className="flex items-center justify-between gap-3">
          <h3 className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Reviews to dispute
          </h3>
          <p className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
            {pendingCount} candidate{pendingCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {candidates.map((candidate) => {
            const selected = candidate.reviewId === (activeCandidate?.reviewId ?? "");
            const existing = disputes.find((d) => d.reviewId === candidate.reviewId);
            return (
              <button
                key={candidate.reviewId}
                type="button"
                onClick={() => applyCandidate(candidate)}
                className={`min-w-[260px] max-w-[300px] shrink-0 rounded-xl border p-4 text-left transition-all ${
                  selected
                    ? isLight
                      ? "border-[#1a73e8] bg-[#e8f0fe] shadow-sm ring-2 ring-[#1a73e8]/20"
                      : "border-cyan-400/50 bg-cyan-500/10 ring-2 ring-cyan-400/20"
                    : isLight
                      ? "border-[#dadce0] bg-white hover:border-[#bdc1c6] hover:shadow-sm"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <StarRating rating={candidate.rating} isLight={isLight} />
                  {candidate.projectedScoreGain > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isLight ? "bg-[#ceead6] text-[#137333]" : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      +{candidate.projectedScoreGain}
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                  {candidate.author}
                </p>
                <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                  {formatReviewDate(candidate.publishedAt)}
                </p>
                <p className={`mt-2 line-clamp-3 text-sm leading-relaxed ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                  {candidate.text || "No review text provided"}
                </p>
                {existing && (
                  <span
                    className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${disputeStatusStyles(existing.status, isLight)}`}
                  >
                    {statusLabel(existing.status)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail workspace */}
      {activeCandidate && (
        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                Selected review
              </p>
              <h3 className={`mt-1 text-xl font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                {activeCandidate.author}
              </h3>
              <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                Posted {formatReviewDate(activeCandidate.publishedAt)}
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${confidenceStyles(activeCandidate.violationConfidence, isLight)}`}
            >
              {activeCandidate.violationConfidence} confidence match
            </span>
          </div>

          <div className={`rounded-xl border p-5 ${isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"}`}>
            <StarRating rating={activeCandidate.rating} isLight={isLight} />
            <blockquote className={`mt-3 text-base leading-relaxed ${isLight ? "text-[#3c4043]" : "text-slate-200"}`}>
              &ldquo;{activeCandidate.text || "No review text"}&rdquo;
            </blockquote>
          </div>

          <div
            className={`rounded-xl border-l-4 p-4 ${
              isLight ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-cyan-400 bg-cyan-500/10"
            }`}
          >
            <p className={`text-sm font-semibold ${isLight ? "text-[#1967d2]" : "text-cyan-300"}`}>
              AI recommendation: {POLICY_VIOLATION_LABELS[activeCandidate.suggestedViolation]}
            </p>
            <p className={`mt-1 text-sm leading-relaxed ${isLight ? "text-[#1967d2]" : "text-cyan-300"}`}>
              {POLICY_VIOLATION_DESCRIPTIONS[activeCandidate.suggestedViolation]}
            </p>
            <p className={`mt-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              {activeCandidate.violationReason}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label
                htmlFor="dispute-policy-violation"
                className={`block text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}
              >
                Policy violation type
              </label>
              <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                Choose the reason that best matches Google&apos;s content policies.
              </p>
              <select
                id="dispute-policy-violation"
                value={policyViolation}
                onChange={(e) => setPolicyViolation(e.target.value as ReviewDisputePolicyViolation)}
                className={`mt-3 w-full rounded-xl border px-4 py-3 text-sm ${
                  isLight
                    ? "border-[#dadce0] bg-white text-[#202124]"
                    : "border-white/10 bg-white/5 text-white"
                }`}
              >
                {REVIEW_DISPUTE_POLICY_VIOLATIONS.map((violation) => (
                  <option key={violation} value={violation}>
                    {POLICY_VIOLATION_LABELS[violation]}
                  </option>
                ))}
              </select>
              <p className={`mt-2 text-sm leading-relaxed ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                {POLICY_VIOLATION_DESCRIPTIONS[policyViolation]}
              </p>
            </div>

            <div>
              <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                What happens next
              </p>
              <ul className={`mt-3 space-y-2 text-sm leading-relaxed ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                <li>1. Save a draft or mark submitted after you file in Google</li>
                <li>2. Use the evidence notes when reporting the review</li>
                <li>3. Come back and record whether Google removed it</li>
              </ul>
            </div>
          </div>

          <div>
            <label
              htmlFor="dispute-evidence"
              className={`block text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}
            >
              Evidence notes
            </label>
            <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
              Edit this template before submitting to Google. Include customer records or context where relevant.
            </p>
            <textarea
              id="dispute-evidence"
              value={evidenceNotes}
              onChange={(e) => setEvidenceNotes(e.target.value)}
              rows={14}
              className={`mt-3 w-full rounded-xl border px-4 py-3 font-mono text-sm leading-relaxed ${
                isLight
                  ? "border-[#dadce0] bg-white text-[#202124]"
                  : "border-white/10 bg-white/5 text-white"
              }`}
            />
          </div>

          <div
            className={`sticky bottom-0 -mx-6 flex flex-wrap items-center gap-3 border-t px-6 py-4 ${
              isLight ? "border-[#e8eaed] bg-white/95" : "border-white/10 bg-[#0b1220]/95"
            } backdrop-blur`}
          >
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleFlag("flagged")}
              className={`rounded-xl px-5 py-2.5 text-sm font-medium ${
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
              className="rounded-xl bg-[#1a73e8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1765cc] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Mark submitted"}
            </button>
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
                isLight
                  ? "border border-[#d2e3fc] bg-[#e8f0fe] text-[#1967d2] hover:bg-[#d2e3fc]"
                  : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15"
              }`}
            >
              Open reviews in Google ↗
            </a>
          </div>

          {activeDispute && ["submitted", "under_review", "flagged"].includes(activeDispute.status) && (
            <div
              className={`rounded-xl border p-5 ${
                isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
                Record Google&apos;s decision
              </p>
              <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
                After Google reviews your report, update the status so we can track score impact.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleResolution("removed")}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Review removed
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleResolution("declined")}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${
                    isLight
                      ? "border border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]"
                      : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Google declined
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
