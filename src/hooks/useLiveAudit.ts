"use client";

import { useCallback, useEffect, useState } from "react";
import type { FullAuditPayload, PathToHealthy } from "@/audit/types";
import { mergeLiveAuditState } from "@/audit/live-audit-merge";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

export interface LiveAuditData {
  audit: FullAuditPayload;
  pathToHealthy: PathToHealthy | null;
  refreshedAt: string | null;
  targetDate: string | null;
}

export function useLiveAudit(
  clientId: string,
  initialAudit: FullAuditPayload | null,
  options?: { scoreLatestDate?: string | null; enabled?: boolean }
): {
  audit: FullAuditPayload | null;
  pathToHealthy: PathToHealthy | null;
  liveRefreshedAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  applyAudit: (next: FullAuditPayload) => void;
} {
  const enabled = options?.enabled ?? Boolean(initialAudit);
  const [audit, setAudit] = useState<FullAuditPayload | null>(initialAudit);
  const [pathToHealthy, setPathToHealthy] = useState<PathToHealthy | null>(null);
  const [liveRefreshedAt, setLiveRefreshedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAudit(initialAudit);
  }, [initialAudit]);

  const refresh = useCallback(async () => {
    if (!clientId || !enabled) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/audit/live?clientId=${encodeURIComponent(clientId)}`
      );
      const data = await parseJsonResponse<{
        error?: string;
        audit?: FullAuditPayload;
        pathToHealthy?: PathToHealthy | null;
        refreshedAt?: string;
      }>(res);

      if (!res.ok || !data.audit) return;

      setAudit((current) =>
        current ? mergeLiveAuditState(current, data.audit!) : data.audit!
      );
      setPathToHealthy(data.pathToHealthy ?? null);
      setLiveRefreshedAt(data.refreshedAt ?? null);
    } catch {
      // Keep last known audit on failure
    } finally {
      setLoading(false);
    }
  }, [clientId, enabled]);

  const applyAudit = useCallback((next: FullAuditPayload) => {
    setAudit((current) => (current ? mergeLiveAuditState(current, next) : next));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh, options?.scoreLatestDate]);

  return { audit, pathToHealthy, liveRefreshedAt, loading, refresh, applyAudit };
}
