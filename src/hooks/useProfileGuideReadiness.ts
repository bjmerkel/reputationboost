"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMPTY_PROFILE_GUIDE_READINESS,
  type ProfileGuideReadiness,
} from "@/lib/profile-guide/readiness";
import { parseJsonResponse } from "@/lib/http/parse-json-response";

const readinessCache = new Map<string, ProfileGuideReadiness>();

export function useProfileGuideReadiness(options: {
  enabled: boolean;
  businessId?: string | null;
}) {
  const { enabled, businessId } = options;
  const cacheKey = businessId ?? "__default__";
  const [readiness, setReadiness] = useState<ProfileGuideReadiness>(
    readinessCache.get(cacheKey) ?? EMPTY_PROFILE_GUIDE_READINESS
  );
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setReadiness(EMPTY_PROFILE_GUIDE_READINESS);
      return EMPTY_PROFILE_GUIDE_READINESS;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const res = await fetch("/api/profile-guide/readiness");
      const json = await parseJsonResponse<{ readiness?: ProfileGuideReadiness; error?: string }>(res);
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load Profile Guide readiness");
      }

      const next = json.readiness ?? EMPTY_PROFILE_GUIDE_READINESS;
      if (requestId === requestIdRef.current) {
        readinessCache.set(cacheKey, next);
        setReadiness(next);
      }
      return next;
    } catch {
      if (requestId === requestIdRef.current) {
        setReadiness(EMPTY_PROFILE_GUIDE_READINESS);
      }
      return EMPTY_PROFILE_GUIDE_READINESS;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [cacheKey, enabled]);

  useEffect(() => {
    const cached = readinessCache.get(cacheKey);
    if (cached) {
      setReadiness(cached);
    }
    void refresh();
  }, [cacheKey, refresh]);

  return { readiness, loading, refresh };
}
