"use client";

import { useCallback, useEffect, useState } from "react";
import type { GbpEvent } from "@/audit/types/gbp-events";

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

  const refresh = useCallback(async () => {
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
