"use client";

import { useCallback, useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

interface OutreachStats {
  webhooks30d: number;
  smsSent30d: number;
  scheduledPending: number;
  attributedReviews30d: number;
  conversionRate: number;
  windowDays: number;
}

interface CustomerEvent {
  id: string;
  event_type: string;
  source: string;
  occurred_at: string;
  review_request_sent: boolean;
  created_at: string;
  payload: Record<string, unknown>;
  customer?: { first_name: string; last_name: string; phone: string } | null;
}

interface SmsRow {
  id: string;
  to_phone: string;
  status: string;
  sent_at: string | null;
  scheduled_at: string | null;
  error_message: string | null;
  created_at: string;
  customers?: { first_name: string; last_name: string } | null;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

function eventStatus(event: CustomerEvent): string {
  if (event.review_request_sent) return "SMS sent";
  if (event.payload.reviewRequestScheduled === true) return "SMS scheduled";
  return "Logged";
}

export default function OutreachActivityPanel() {
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [sms, setSms] = useState<SmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers/activity");
      const data = await parseJsonResponse<{
        stats: OutreachStats;
        events: CustomerEvent[];
        sms: SmsRow[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load activity");
      setStats(data.stats);
      setEvents(data.events);
      setSms(data.sms);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
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
        <p className="text-sm text-[#5f6368]">Loading outreach activity…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#202124]">Outreach results</h2>
          <p className="mt-1 text-sm text-[#5f6368]">
            Last 30 days — webhook events, texts sent, and reviews attributed to outreach.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
        >
          Refresh
        </button>
      </div>

      {stats && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-[#f8f9fa] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">Webhooks</p>
            <p className="mt-1 text-2xl font-bold text-[#202124]">{stats.webhooks30d}</p>
          </div>
          <div className="rounded-lg bg-[#f8f9fa] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">SMS sent</p>
            <p className="mt-1 text-2xl font-bold text-[#202124]">{stats.smsSent30d}</p>
          </div>
          <div className="rounded-lg bg-[#f8f9fa] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">Scheduled</p>
            <p className="mt-1 text-2xl font-bold text-[#202124]">{stats.scheduledPending}</p>
          </div>
          <div className="rounded-lg bg-[#f8f9fa] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
              Attributed reviews
            </p>
            <p className="mt-1 text-2xl font-bold text-[#202124]">{stats.attributedReviews30d}</p>
            <p className="mt-1 text-xs text-[#5f6368]">
              {stats.conversionRate}% of SMS ({stats.windowDays}d window)
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold text-[#202124]">Recent webhook events</h3>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#dadce0]">
            {events.length === 0 ? (
              <p className="p-4 text-sm text-[#5f6368]">No webhook events yet.</p>
            ) : (
              <ul className="divide-y divide-[#dadce0]">
                {events.map((event) => (
                  <li key={event.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#202124]">{event.event_type}</span>
                      <span className="text-xs text-[#80868b]">{eventStatus(event)}</span>
                    </div>
                    <p className="mt-1 text-[#5f6368]">
                      {event.customer
                        ? `${event.customer.first_name} ${event.customer.last_name}`.trim()
                        : "Customer"}{" "}
                      · {event.source}
                    </p>
                    <p className="text-xs text-[#80868b]">{formatWhen(event.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-[#202124]">Recent messages</h3>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#dadce0]">
            {sms.length === 0 ? (
              <p className="p-4 text-sm text-[#5f6368]">No messages yet.</p>
            ) : (
              <ul className="divide-y divide-[#dadce0]">
                {sms.map((row) => (
                  <li key={row.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#202124]">{row.to_phone}</span>
                      <span className="rounded-full bg-[#e8f0fe] px-2 py-0.5 text-xs font-medium text-[#1a73e8]">
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#80868b]">
                      {row.sent_at
                        ? `Sent ${formatWhen(row.sent_at)}`
                        : row.scheduled_at
                          ? `Scheduled ${formatWhen(row.scheduled_at)}`
                          : formatWhen(row.created_at)}
                    </p>
                    {row.error_message && (
                      <p className="mt-1 text-xs text-red-600">{row.error_message}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
