"use client";

import Link from "next/link";
import { isPerformancePermissionError } from "@/lib/google/performance-errors";

export default function PerformancePermissionBanner({
  error,
  businessId,
}: {
  error?: string;
  businessId?: string;
}) {
  if (!error || !isPerformancePermissionError(error)) return null;

  const reconnectHref = businessId
    ? `/api/google/gbp/connect?businessId=${businessId}`
    : "/platform/settings";

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
      <p className="text-sm font-medium text-amber-200">Performance metrics unavailable</p>
      <p className="mt-1 text-sm text-slate-400">
        Google returned &ldquo;permission denied&rdquo; for calls, profile views, and direction
        clicks. Enable the{" "}
        <strong className="text-slate-300">Business Profile Performance API</strong> in your Google
        Cloud project, then reconnect GBP.
      </p>
      <Link
        href="/platform/settings"
        className="mt-3 inline-block text-sm font-semibold text-emerald-400 hover:text-emerald-300"
      >
        View setup steps in Settings →
      </Link>
      {businessId && (
        <span className="mx-2 text-slate-600">·</span>
      )}
      {businessId && (
        <a
          href={reconnectHref}
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Reconnect now
        </a>
      )}
    </div>
  );
}
