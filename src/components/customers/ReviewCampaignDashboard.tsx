"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import type { CampaignDashboardRow } from "@/lib/review-requests/campaign-progress";

interface ReviewCampaignDashboardProps {
  onFocusKeyword?: (keyword: string) => void;
}

export default function ReviewCampaignDashboard({
  onFocusKeyword,
}: ReviewCampaignDashboardProps) {
  const [active, setActive] = useState<CampaignDashboardRow[]>([]);
  const [completed, setCompleted] = useState<CampaignDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review-campaigns");
      const data = await parseJsonResponse<{
        active: CampaignDashboardRow[];
        completed: CampaignDashboardRow[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load campaigns");
      setActive(data.active);
      setCompleted(data.completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5f6368]">Loading review campaigns…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#d93025]">{error}</p>
      </div>
    );
  }

  if (active.length === 0 && completed.length === 0) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#202124]">Review campaigns</h2>
        <p className="mt-2 text-sm text-[#5f6368]">
          No keyword campaigns yet. Send your first review request batch from the plan or below —
          we&apos;ll track progress per keyword automatically.
        </p>
        <Link href="/platform/audit?view=strategy" className="mt-3 inline-block text-sm font-semibold text-[#1a73e8] hover:underline">
          Open optimization plan →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#202124]">Review campaigns</h2>
          <p className="mt-1 text-sm text-[#5f6368]">
            Keyword-specific outreach progress — mentions since campaign start and SMS-attributed reviews.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-[#dadce0] px-4 py-1.5 text-xs font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
        >
          Refresh
        </button>
      </div>

      {active.length > 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">Active</p>
          {active.map((row) => (
            <CampaignRow key={row.campaignId} row={row} onFocusKeyword={onFocusKeyword} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">Completed</p>
          {completed.slice(0, 5).map((row) => (
            <CampaignRow key={row.campaignId} row={row} completed onFocusKeyword={onFocusKeyword} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignRow({
  row,
  completed = false,
  onFocusKeyword,
}: {
  row: CampaignDashboardRow;
  completed?: boolean;
  onFocusKeyword?: (keyword: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#202124]">&ldquo;{row.keyword}&rdquo;</p>
          <p className="mt-0.5 text-xs text-[#5f6368]">
            Started {new Date(row.startedAt).toLocaleDateString()}
            {completed && row.completedAt
              ? ` · Completed ${new Date(row.completedAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            completed ? "bg-[#ceead6] text-[#137333]" : "bg-[#d2e3fc] text-[#1a73e8]"
          }`}
        >
          {completed ? "Complete" : "Active"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 text-xs text-[#3c4043] sm:grid-cols-3">
        <div>
          <p className="text-[#80868b]">Progress</p>
          <p className="font-semibold">
            {row.effectiveMentions} / {row.targetReviews} reviews
          </p>
        </div>
        <div>
          <p className="text-[#80868b]">Since start</p>
          <p className="font-semibold">{row.newMentionsSinceStart} keyword mentions</p>
        </div>
        <div>
          <p className="text-[#80868b]">From SMS</p>
          <p className="font-semibold">{row.attributedReviews} attributed</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-[#80868b]">
          <span>{row.reviewsRemaining > 0 ? `${row.reviewsRemaining} to go` : "Target met"}</span>
          <span className="font-semibold text-[#202124]">{row.progressPercent}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e8eaed]">
          <div
            className={`h-full rounded-full ${completed ? "bg-[#188038]" : "bg-[#1a73e8]"}`}
            style={{ width: `${row.progressPercent}%` }}
          />
        </div>
      </div>

      {!completed && onFocusKeyword && (
        <button
          type="button"
          onClick={() => onFocusKeyword(row.keyword)}
          className="mt-3 text-xs font-semibold text-[#1a73e8] hover:underline"
        >
          Send next batch for this keyword →
        </button>
      )}
    </div>
  );
}
