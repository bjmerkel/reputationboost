"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PreviewAuditResult } from "@/audit/preview-audit";
import type { FullAuditPayload } from "@/audit/types";
import {
  createMarketingDemoAudit,
  DEMO_BUSINESS,
} from "@/lib/marketing/demo-audit";

interface PreviewAuditContextValue {
  preview: PreviewAuditResult | null;
  platformAudit: FullAuditPayload;
  businessName: string;
  industry: string;
  location: { lat: number; lng: number; address: string };
  isLive: boolean;
  loading: boolean;
  setPreviewResult: (result: PreviewAuditResult | null) => void;
  setLoading: (loading: boolean) => void;
  clearPreview: () => void;
}

const PreviewAuditContext = createContext<PreviewAuditContextValue | null>(null);

export function PreviewAuditProvider({ children }: { children: React.ReactNode }) {
  const [preview, setPreview] = useState<PreviewAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const demoAudit = useMemo(() => createMarketingDemoAudit(), []);

  const setPreviewResult = useCallback((result: PreviewAuditResult | null) => {
    setPreview(result);
  }, []);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setLoading(false);
  }, []);

  const value = useMemo<PreviewAuditContextValue>(() => {
    if (preview) {
      return {
        preview,
        platformAudit: preview.platformAudit,
        businessName: preview.business.name,
        industry: preview.business.industry,
        location: preview.location,
        isLive: true,
        loading,
        setPreviewResult,
        setLoading,
        clearPreview,
      };
    }

    return {
      preview: null,
      platformAudit: demoAudit,
      businessName: DEMO_BUSINESS.name,
      industry: DEMO_BUSINESS.industry,
      location: DEMO_BUSINESS.location,
      isLive: false,
      loading,
      setPreviewResult,
      setLoading,
      clearPreview,
    };
  }, [preview, demoAudit, loading, setPreviewResult, clearPreview]);

  return (
    <PreviewAuditContext.Provider value={value}>{children}</PreviewAuditContext.Provider>
  );
}

export function usePreviewAudit() {
  const context = useContext(PreviewAuditContext);
  if (!context) {
    throw new Error("usePreviewAudit must be used within PreviewAuditProvider");
  }
  return context;
}
