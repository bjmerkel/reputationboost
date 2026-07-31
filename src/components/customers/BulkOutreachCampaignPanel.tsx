"use client";

import { useCallback, useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import { channelLabel } from "@/lib/review-requests/channel";
import type { OutreachCampaignStatus } from "@/lib/review-requests/outreach-campaign";

interface OutreachCampaignRow {
  id: string;
  status: OutreachCampaignStatus;
  channel: "sms" | "email" | "auto";
  targetCount: number;
  queuedSmsCount: number;
  queuedEmailCount: number;
  sentCount: number;
  failedCount: number;
  dailySendCap: number;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

function statusLabel(status: OutreachCampaignStatus): string {
  switch (status) {
    case "queuing":
      return "Queuing";
    case "active":
      return "Sending";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    case "planning":
      return "Planning";
    default:
      return status;
  }
}

function progressPercent(row: OutreachCampaignRow): number {
  const queued = row.queuedSmsCount + row.queuedEmailCount;
  const done = row.sentCount + row.failedCount;
  const total = queued + done;
  if (total === 0) return row.status === "completed" ? 100 : 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export default function BulkOutreachCampaignPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [active, setActive] = useState<OutreachCampaignRow[]>([]);
  const [completed, setCompleted] = useState<OutreachCampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review-requests/campaigns");
      const data = await parseJsonResponse<{
        active?: OutreachCampaignRow[];
        completed?: OutreachCampaignRow[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load bulk campaigns");
      setActive(data.active ?? []);
      setCompleted((data.completed ?? []).slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bulk campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (active.length === 0) return;
    const hasInProgress = active.some((row) => row.status === "queuing" || row.status === "active");
    if (!hasInProgress) return;

    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  async function handleCancel(campaignId: string) {
    if (!confirm("Cancel all pending messages in this campaign?")) return;
    setCancellingId(campaignId);
    try {
      const res = await fetch(`/api/review-requests/campaigns/${campaignId}/cancel`, {
        method: "POST",
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  }

  if (loading && active.length === 0 && completed.length === 0) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5f6368]">Loading bulk outreach campaigns…</p>
      </div>
    );
  }

  if (error && active.length === 0 && completed.length === 0) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#d93025]">{error}</p>
      </div>
    );
  }

  if (active.length === 0 && completed.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#202124]">Bulk outreach campaigns</h2>
      <p className="mt-1 text-sm text-[#5f6368]">
        Large customer sends are queued and spread over several days to protect deliverability.
      </p>

      {error && <p className="mt-3 text-sm text-[#d93025]">{error}</p>}

      {active.length > 0 && (
        <ul className="mt-4 space-y-3">
          {active.map((row) => {
            const pct = progressPercent(row);
            const queuedTotal = row.queuedSmsCount + row.queuedEmailCount;
            return (
              <li
                key={row.id}
                className="rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-[#202124]">
                      {channelLabel(row.channel)} · {row.targetCount} customers
                    </span>
                    <span className="ml-2 text-xs text-[#80868b]">{statusLabel(row.status)}</span>
                  </div>
                  {(row.status === "queuing" || row.status === "active") && (
                    <button
                      type="button"
                      disabled={cancellingId === row.id}
                      onClick={() => void handleCancel(row.id)}
                      className="text-xs font-semibold text-[#d93025] hover:underline disabled:opacity-50"
                    >
                      {cancellingId === row.id ? "Cancelling…" : "Cancel pending"}
                    </button>
                  )}
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#dadce0]">
                  <div
                    className="h-2 rounded-full bg-[#1a73e8] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[#5f6368]">
                  {row.sentCount} sent · {row.failedCount} failed · {queuedTotal} queued (
                  {row.queuedSmsCount} SMS, {row.queuedEmailCount} email) · {row.dailySendCap}/day
                  cap
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {completed.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold text-[#202124]">Recent</h3>
          <ul className="mt-2 space-y-2 text-sm text-[#5f6368]">
            {completed.map((row) => (
              <li key={row.id}>
                {channelLabel(row.channel)} · {row.targetCount} customers · {statusLabel(row.status)}
                {row.sentCount > 0 ? ` · ${row.sentCount} sent` : ""}
                {row.errorMessage ? ` · ${row.errorMessage}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
