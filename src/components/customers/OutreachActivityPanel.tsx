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

interface ActivityFilters {
  eventTypes: string[];
  sources: string[];
}

const EVENTS_PAGE_SIZE = 25;
const SMS_PAGE_SIZE = 20;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

function eventStatus(event: CustomerEvent): string {
  if (event.payload.optedOut === true) return "Opted out";
  if (event.review_request_sent) return "SMS sent";
  if (event.payload.reviewRequestScheduled === true) return "SMS scheduled";
  return "Logged";
}

export default function OutreachActivityPanel() {
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsOffset, setEventsOffset] = useState(0);
  const [sms, setSms] = useState<SmsRow[]>([]);
  const [smsTotal, setSmsTotal] = useState(0);
  const [smsOffset, setSmsOffset] = useState(0);
  const [filters, setFilters] = useState<ActivityFilters | null>(null);
  const [eventType, setEventType] = useState("");
  const [source, setSource] = useState("");
  const [sentOnly, setSentOnly] = useState("");
  const [optedOutOnly, setOptedOutOnly] = useState(false);
  const [smsStatus, setSmsStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (options?: { eventsOffset?: number; smsOffset?: number; reset?: boolean }) => {
      setLoading(true);
      setError(null);

      const nextEventsOffset = options?.reset ? 0 : (options?.eventsOffset ?? eventsOffset);
      const nextSmsOffset = options?.reset ? 0 : (options?.smsOffset ?? smsOffset);

      const params = new URLSearchParams({
        eventsLimit: String(EVENTS_PAGE_SIZE),
        eventsOffset: String(nextEventsOffset),
        smsLimit: String(SMS_PAGE_SIZE),
        smsOffset: String(nextSmsOffset),
        includeFilters: "1",
      });
      if (eventType) params.set("eventType", eventType);
      if (source) params.set("source", source);
      if (sentOnly) params.set("sentOnly", sentOnly);
      if (optedOutOnly) params.set("optedOutOnly", "1");
      if (smsStatus) params.set("smsStatus", smsStatus);

      try {
        const res = await fetch(`/api/customers/activity?${params.toString()}`);
        const data = await parseJsonResponse<{
          stats: OutreachStats;
          events: CustomerEvent[];
          eventsTotal: number;
          sms: SmsRow[];
          smsTotal: number;
          filters: ActivityFilters | null;
          error?: string;
        }>(res);
        if (!res.ok) throw new Error(data.error ?? "Failed to load activity");

        setStats(data.stats);
        setEvents(data.events);
        setEventsTotal(data.eventsTotal);
        setEventsOffset(nextEventsOffset);
        setSms(data.sms);
        setSmsTotal(data.smsTotal);
        setSmsOffset(nextSmsOffset);
        if (data.filters) setFilters(data.filters);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      } finally {
        setLoading(false);
      }
    },
    [eventType, source, sentOnly, optedOutOnly, smsStatus, eventsOffset, smsOffset]
  );

  useEffect(() => {
    void load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, source, sentOnly, optedOutOnly, smsStatus]);

  const hasMoreEvents = eventsOffset + events.length < eventsTotal;
  const hasMoreSms = smsOffset + sms.length < smsTotal;

  if (loading && !stats) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5f6368]">Loading outreach activity…</p>
      </div>
    );
  }

  if (error && !stats) {
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
          onClick={() => void load({ reset: true })}
          className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] hover:bg-[#f8f9fa]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

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

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
        >
          <option value="">All event types</option>
          {(filters?.eventTypes ?? []).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
        >
          <option value="">All sources</option>
          {(filters?.sources ?? []).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={sentOnly}
          onChange={(e) => setSentOnly(e.target.value)}
          className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
        >
          <option value="">Any SMS status</option>
          <option value="1">SMS sent only</option>
          <option value="0">No SMS sent</option>
        </select>
        <select
          value={smsStatus}
          onChange={(e) => setSmsStatus(e.target.value)}
          className="rounded-lg border border-[#dadce0] px-3 py-2 text-sm"
        >
          <option value="">All message statuses</option>
          <option value="sent">Sent</option>
          <option value="scheduled">Scheduled</option>
          <option value="simulated">Simulated</option>
          <option value="failed">Failed</option>
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-[#dadce0] px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={optedOutOnly}
            onChange={(e) => setOptedOutOnly(e.target.checked)}
          />
          Opt-outs only
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#202124]">Recent webhook events</h3>
            <span className="text-xs text-[#80868b]">
              {events.length} of {eventsTotal}
            </span>
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#dadce0]">
            {events.length === 0 ? (
              <p className="p-4 text-sm text-[#5f6368]">No webhook events match these filters.</p>
            ) : (
              <ul className="divide-y divide-[#dadce0]">
                {events.map((event) => (
                  <li key={event.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#202124]">{event.event_type}</span>
                      <span
                        className={`text-xs ${
                          event.payload.optedOut === true ? "text-red-600" : "text-[#80868b]"
                        }`}
                      >
                        {eventStatus(event)}
                      </span>
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
          {hasMoreEvents && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load({ eventsOffset: eventsOffset + EVENTS_PAGE_SIZE })}
              className="mt-2 text-sm font-semibold text-[#1a73e8] hover:underline disabled:opacity-50"
            >
              Load more events
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#202124]">Recent messages</h3>
            <span className="text-xs text-[#80868b]">
              {sms.length} of {smsTotal}
            </span>
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-[#dadce0]">
            {sms.length === 0 ? (
              <p className="p-4 text-sm text-[#5f6368]">No messages match these filters.</p>
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
          {hasMoreSms && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load({ smsOffset: smsOffset + SMS_PAGE_SIZE })}
              className="mt-2 text-sm font-semibold text-[#1a73e8] hover:underline disabled:opacity-50"
            >
              Load more messages
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
