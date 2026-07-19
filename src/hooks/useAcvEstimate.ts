"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AcvEstimateResult } from "@/lib/llm/acv-estimate";

const estimateCache = new Map<string, AcvEstimateResult>();

function cacheKey(businessId: string, clientId: string): string {
  return `${businessId}:${clientId}`;
}

export function useAcvEstimate(options: {
  enabled: boolean;
  businessId?: string | null;
  clientId: string;
  businessName: string;
  primaryCategory: string;
  city?: string;
  state?: string;
  industry?: string | null;
}) {
  const {
    enabled,
    businessId,
    clientId,
    businessName,
    primaryCategory,
    city = "",
    state = "",
    industry,
  } = options;

  const [estimate, setEstimate] = useState<AcvEstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchEstimate = useCallback(async () => {
    if (!enabled || !businessId) return null;

    const key = cacheKey(businessId, clientId);
    const cached = estimateCache.get(key);
    if (cached) {
      setEstimate(cached);
      return cached;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/business/acv-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          clientId,
          businessName,
          primaryCategory,
          city,
          state,
          industry,
        }),
      });
      const data = (await res.json()) as {
        estimate?: AcvEstimateResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to estimate customer value");
      if (requestId !== requestIdRef.current) return null;

      const next = data.estimate ?? null;
      if (next) estimateCache.set(key, next);
      setEstimate(next);
      return next;
    } catch (err) {
      if (requestId !== requestIdRef.current) return null;
      setError(err instanceof Error ? err.message : "Failed to estimate customer value");
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    businessId,
    businessName,
    city,
    clientId,
    enabled,
    industry,
    primaryCategory,
    state,
  ]);

  useEffect(() => {
    if (!enabled || !businessId) {
      setEstimate(null);
      setError(null);
      setLoading(false);
      return;
    }
    void fetchEstimate();
  }, [businessId, enabled, fetchEstimate]);

  return { estimate, loading, error, refresh: fetchEstimate };
}
