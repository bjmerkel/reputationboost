"use client";

import { useCallback, useEffect, useState } from "react";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

export interface MarketStatus {
  callsBudget: number;
  callsReserved: number;
  callsRemaining: number;
  collectionsSkipped: number;
  canRefresh: boolean;
  cooldownAvailableAt: string | null;
  lastManualRefreshAt: string | null;
  marketObservedAt: string | null;
  nextScheduledAt: string;
  pendingRefreshAt: string | null;
  pendingTrigger: string | null;
}

export function useMarketStatus(clientId: string, enabled: boolean) {
  const [status, setStatus] = useState<MarketStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clientId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/market/status?clientId=${encodeURIComponent(clientId)}`
      );
      const data = await parseJsonResponse<MarketStatus & { error?: string }>(
        res
      );
      if (!res.ok) throw new Error(data.error ?? "Failed to load market status");
      setStatus(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load market status");
    } finally {
      setLoading(false);
    }
  }, [clientId, enabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return { status, loading, error, refresh };
}
