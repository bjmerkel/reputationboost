"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GbpAccountSummary from "@/components/GbpAccountSummary";
import { PerformanceAccessDetails } from "@/components/PerformancePermissionBanner";
import type { GbpLocationAccessCheck } from "@/lib/google/gbp-access";
import type { PerformanceEndpointStatus } from "@/lib/google/gbp-performance";
import {
  GBP_API_ACCESS_FORM_URL,
  PERFORMANCE_API_ENABLE_URL,
} from "@/lib/google/performance-errors";

interface PerformanceProbe {
  ok: boolean;
  partial?: boolean;
  permissionDenied?: boolean;
  error?: string;
  setupSteps?: string[];
  platformEmail?: string;
  googleAccountEmail?: string;
  accountMismatch?: boolean;
  sampleMetrics?: {
    calls: number;
    directionRequests: number;
    websiteClicks: number;
    profileViews: number;
  };
  endpoints?: {
    coreMetrics: PerformanceEndpointStatus;
    impressions: PerformanceEndpointStatus;
    searchKeywords: PerformanceEndpointStatus;
  };
  accessCheck?: GbpLocationAccessCheck;
}

function endpointLabel(status: PerformanceEndpointStatus | undefined): string {
  switch (status) {
    case "ok":
      return "OK";
    case "denied":
      return "Permission denied";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    default:
      return "Unknown";
  }
}

export default function GbpPerformanceSetup({
  businessId,
  reconnectHref,
  platformEmail,
  storedGoogleEmail,
}: {
  businessId: string;
  reconnectHref: string;
  platformEmail?: string;
  storedGoogleEmail?: string;
}) {
  const [probe, setProbe] = useState<PerformanceProbe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/google/gbp/performance");
        const data = await res.json();
        if (!cancelled) setProbe(data);
      } catch {
        if (!cancelled) setProbe({ ok: false, error: "Could not reach performance API" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const googleAccountEmail =
    probe?.googleAccountEmail ??
    probe?.accessCheck?.googleAccountEmail ??
    storedGoogleEmail;
  const resolvedPlatformEmail =
    probe?.platformEmail ?? probe?.accessCheck?.platformEmail ?? platformEmail;
  const accountMismatch =
    probe?.accountMismatch ??
    probe?.accessCheck?.accountMismatch ??
    Boolean(
      resolvedPlatformEmail &&
        googleAccountEmail &&
        resolvedPlatformEmail.toLowerCase() !== googleAccountEmail.toLowerCase()
    );
  const gbpAccessVerified =
    probe?.accessCheck?.gbpAccessVerified ??
    probe?.accessCheck?.status === "confirmed_manager";

  const accountSummary = (
    <GbpAccountSummary
      platformEmail={resolvedPlatformEmail}
      googleAccountEmail={loading ? storedGoogleEmail : googleAccountEmail}
      accountMismatch={accountMismatch}
      gbpAccessVerified={gbpAccessVerified}
    />
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {accountSummary}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 text-sm text-slate-400">
          Checking Business Profile Performance API access…
        </div>
      </div>
    );
  }

  if (probe?.ok) {
    return (
      <div className="space-y-4">
        {accountSummary}
        <div
          className={`rounded-2xl border p-6 ${
            probe.partial
              ? "border-amber-500/25 bg-amber-500/10"
              : "border-emerald-500/25 bg-emerald-500/10"
          }`}
        >
          <h2 className="text-lg font-bold text-white">Performance API</h2>
          <p className={`mt-2 text-sm ${probe.partial ? "text-amber-200" : "text-emerald-200"}`}>
            {probe.partial ? "Partially connected" : "Connected"} — last 7 days:{" "}
            {probe.sampleMetrics?.profileViews ?? 0} profile views,{" "}
            {probe.sampleMetrics?.calls ?? 0} call clicks,{" "}
            {probe.sampleMetrics?.directionRequests ?? 0} direction requests.
          </p>
          {probe.endpoints && (
            <ul className="mt-3 space-y-1 text-xs text-slate-400">
              <li>Core metrics: {endpointLabel(probe.endpoints.coreMetrics)}</li>
              <li>Profile views: {endpointLabel(probe.endpoints.impressions)}</li>
              <li>Search keywords: {endpointLabel(probe.endpoints.searchKeywords)}</li>
            </ul>
          )}
        </div>
      </div>
    );
  }

  const accessCheck = probe?.accessCheck;
  const severity = accessCheck?.severity ?? "warning";
  const containerClass =
    severity === "info"
      ? "rounded-2xl border border-slate-500/25 bg-slate-500/10 p-6"
      : "rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6";
  const titleClass = severity === "info" ? "text-slate-100" : "text-amber-100";

  return (
    <div className="space-y-4">
      {accountSummary}
      <div className={containerClass}>
        <h2 className={`text-lg font-bold ${titleClass}`}>
          {accessCheck?.headline ?? "Performance API not authorized"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {accessCheck?.detail ??
            probe?.error ??
            "Google returned permission denied for profile views, calls, and direction clicks."}
        </p>
        {accessCheck?.suggestion && (
          <p className="mt-3 text-sm text-slate-300">{accessCheck.suggestion}</p>
        )}
        {accessCheck && <PerformanceAccessDetails accessCheck={accessCheck} />}
        {probe?.endpoints && (
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            <li>Core metrics: {endpointLabel(probe.endpoints.coreMetrics)}</li>
            <li>Profile views: {endpointLabel(probe.endpoints.impressions)}</li>
            <li>Search keywords: {endpointLabel(probe.endpoints.searchKeywords)}</li>
          </ul>
        )}

        {severity === "warning" && (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            {(probe?.setupSteps ?? []).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {severity === "warning" && (
            <>
              <a
                href={PERFORMANCE_API_ENABLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary rounded-full px-5 py-2 text-sm font-semibold text-white"
              >
                Enable Performance API
              </a>
              <a
                href={GBP_API_ACCESS_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary rounded-full px-5 py-2 text-sm font-semibold text-white"
              >
                GBP API access form
              </a>
            </>
          )}
        {severity !== "info" && !gbpAccessVerified && (
          <Link
            href={reconnectHref}
            className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            Reconnect with a different Google account
          </Link>
        )}
        </div>

        <p className="mt-4 text-xs text-slate-500">Business ID: {businessId}</p>
      </div>
    </div>
  );
}
