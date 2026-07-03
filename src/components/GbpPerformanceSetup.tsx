"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GbpAccountSummary from "@/components/GbpAccountSummary";
import type { GbpLocationAccessCheck } from "@/lib/google/gbp-access";

interface PerformanceProbe {
  ok: boolean;
  partial?: boolean;
  error?: string;
  platformEmail?: string;
  googleAccountEmail?: string;
  accountMismatch?: boolean;
  sampleMetrics?: {
    calls: number;
    directionRequests: number;
    websiteClicks: number;
    profileViews: number;
  };
  accessCheck?: GbpLocationAccessCheck;
}

export default function GbpPerformanceSetup({
  reconnectHref,
  platformEmail,
  storedGoogleEmail,
  variant = "dark",
}: {
  businessId: string;
  reconnectHref: string;
  platformEmail?: string;
  storedGoogleEmail?: string;
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";
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
        if (!cancelled) setProbe({ ok: false });
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

  const accessCheck = probe?.accessCheck;
  const severity = accessCheck?.severity ?? (gbpAccessVerified ? "info" : "warning");
  const headline =
    accessCheck?.headline ??
    (gbpAccessVerified
      ? "Call & view insights aren't available right now"
      : "Couldn't load Google insights");
  const detail =
    accessCheck?.detail ??
    "Call clicks and profile views aren't loading for this location. Your profile, reviews, and rankings still work.";
  const suggestion = accessCheck?.suggestion;

  const accountSummary = (
    <GbpAccountSummary
      platformEmail={resolvedPlatformEmail}
      googleAccountEmail={loading ? storedGoogleEmail : googleAccountEmail}
      accountMismatch={accountMismatch}
      gbpAccessVerified={gbpAccessVerified}
      variant={variant}
    />
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {accountSummary}
        <div
          className={`rounded-xl border p-6 text-sm ${
            isLight
              ? "border-[#dadce0] bg-white text-[#5f6368] shadow-sm"
              : "border-white/8 bg-white/[0.02] text-slate-400"
          }`}
        >
          Checking your Google Business Profile connection…
        </div>
      </div>
    );
  }

  if (probe?.ok) {
    const metrics = probe.sampleMetrics;
    return (
      <div className="space-y-4">
        {accountSummary}
        <div
          className={`rounded-xl border p-6 ${
            probe.partial
              ? isLight
                ? "border-[#feefc3] bg-[#fef7e0]"
                : "border-amber-500/25 bg-amber-500/10"
              : isLight
                ? "border-[#ceead6] bg-[#e6f4ea]"
                : "border-emerald-500/25 bg-emerald-500/10"
          }`}
        >
          <h2 className={`text-lg font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Profile insights
          </h2>
          <p
            className={`mt-2 text-sm ${
              probe.partial
                ? isLight
                  ? "text-[#b06000]"
                  : "text-amber-200"
                : isLight
                  ? "text-[#137333]"
                  : "text-emerald-200"
            }`}
          >
            Last 7 days: {metrics?.profileViews ?? 0} profile views, {metrics?.calls ?? 0} calls,{" "}
            {metrics?.directionRequests ?? 0} direction requests.
          </p>
        </div>
      </div>
    );
  }

  const containerClass = isLight
    ? severity === "info"
      ? "rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-6"
      : "rounded-xl border border-[#feefc3] bg-[#fef7e0] p-6"
    : severity === "info"
      ? "rounded-2xl border border-slate-500/20 bg-slate-500/5 p-6"
      : "rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6";

  const titleClass = isLight
    ? severity === "info"
      ? "text-[#3c4043]"
      : "text-[#b06000]"
    : severity === "info"
      ? "text-slate-200"
      : "text-amber-100";

  return (
    <div className="space-y-4">
      {accountSummary}
      <div className={containerClass}>
        <h2 className={`text-lg font-bold ${titleClass}`}>{headline}</h2>
        <p className={`mt-2 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>{detail}</p>
        {suggestion && (
          <p className={`mt-3 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
            {suggestion}
          </p>
        )}

        {severity === "warning" && !gbpAccessVerified && (
          <Link
            href={reconnectHref}
            className={`mt-5 inline-block rounded-full border px-5 py-2 text-sm font-semibold ${
              isLight
                ? "border-[#dadce0] text-[#3c4043] hover:bg-white"
                : "border-white/15 text-slate-200 hover:bg-white/5"
            }`}
          >
            Reconnect Google Business Profile
          </Link>
        )}
      </div>
    </div>
  );
}
