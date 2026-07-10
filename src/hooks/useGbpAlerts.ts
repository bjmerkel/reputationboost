"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GbpEvent } from "@/audit/types/gbp-events";

/** Avoid hammering Google when the command center remounts within a session. */
const SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const lastSyncByClient = new Map<string, number>();

export function useGbpAlerts(clientId?: string): {
  events: GbpEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  acknowledge: (eventId: string) => Promise<void>;
} {
  const [events, setEvents] = useState<GbpEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(clientId));
  const [error, setError] = useState<string | null>(null);
  const syncInFlight = useRef(false);

  const loadCached = useCallback(async () => {
    if (!clientId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/gbp/alerts?clientId=${encodeURIComponent(clientId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load alerts");
      }
      setEvents(data.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const syncFromGoogle = useCallback(async () => {
    if (!clientId || syncInFlight.current) return;

    const last = lastSyncByClient.get(clientId) ?? 0;
    if (Date.now() - last < SYNC_COOLDOWN_MS) return;

    syncInFlight.current = true;
    try {
      const res = await fetch("/api/gbp/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, action: "refresh" }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Keep cached alerts if live refresh fails.
        return;
      }
      lastSyncByClient.set(clientId, Date.now());
      setEvents(data.events ?? []);
      setError(null);
    } catch {
      // Ignore sync errors — cached feed remains visible.
    } finally {
      syncInFlight.current = false;
    }
  }, [clientId]);

  const refresh = useCallback(async () => {
    await loadCached();
    await syncFromGoogle();
  }, [loadCached, syncFromGoogle]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const acknowledge = useCallback(
    async (eventId: string) => {
      const res = await fetch("/api/gbp/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to dismiss alert");
      }
      setEvents((current) => current.filter((event) => event.id !== eventId));
    },
    []
  );

  return { events, loading, error, refresh, acknowledge };
}
