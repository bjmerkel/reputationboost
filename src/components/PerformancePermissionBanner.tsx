"use client";

import Link from "next/link";
import type { GbpLocationAccessCheck } from "@/lib/google/gbp-access";

export default function PerformancePermissionBanner({
  accessCheck,
  businessId,
}: {
  error?: string;
  accessCheck?: GbpLocationAccessCheck;
  businessId?: string;
}) {
  if (!accessCheck) return null;

  const severity = accessCheck.severity;
  const gbpAccessVerified = accessCheck.gbpAccessVerified;

  if (severity === "info" && gbpAccessVerified) {
    return (
      <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 px-5 py-4">
        <p className="text-sm font-medium text-slate-300">{accessCheck.headline}</p>
        <p className="mt-1 text-sm text-slate-500">{accessCheck.detail}</p>
      </div>
    );
  }

  const reconnectHref = businessId
    ? `/api/google/gbp/connect?businessId=${businessId}`
    : "/platform/settings";

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-5 py-4">
      <p className="text-sm font-medium text-amber-200">{accessCheck.headline}</p>
      <p className="mt-1 text-sm text-slate-400">{accessCheck.detail}</p>
      {accessCheck.suggestion && (
        <p className="mt-2 text-sm text-slate-300">{accessCheck.suggestion}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
        <Link
          href="/platform/settings"
          className="font-semibold text-emerald-400 hover:text-emerald-300"
        >
          Settings
        </Link>
        {!gbpAccessVerified && businessId && (
          <>
            <span className="text-slate-600">·</span>
            <a
              href={reconnectHref}
              className="font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Reconnect Google Business Profile
            </a>
          </>
        )}
      </div>
    </div>
  );
}
