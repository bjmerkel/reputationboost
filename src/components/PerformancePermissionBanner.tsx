"use client";

import Link from "next/link";
import type { GbpLocationAccessCheck } from "@/lib/google/gbp-access";

export default function PerformancePermissionBanner({
  accessCheck,
  businessId,
  variant = "dark",
}: {
  error?: string;
  accessCheck?: GbpLocationAccessCheck;
  businessId?: string;
  variant?: "dark" | "light";
}) {
  if (!accessCheck) return null;

  const isLight = variant === "light";
  const severity = accessCheck.severity;
  const gbpAccessVerified = accessCheck.gbpAccessVerified;

  if (severity === "info" && gbpAccessVerified) {
    return (
      <div
        className={`mb-3 rounded-lg border px-4 py-3 ${
          isLight
            ? "border-[#dadce0] bg-[#f8f9fa]"
            : "border-slate-500/20 bg-slate-500/5"
        }`}
      >
        <p className={`text-sm font-medium ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
          {accessCheck.headline}
        </p>
        <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-500"}`}>
          {accessCheck.detail}
        </p>
      </div>
    );
  }

  const reconnectHref = businessId
    ? `/api/google/gbp/connect?businessId=${businessId}`
    : "/platform/settings";

  return (
    <div
      className={`mb-3 rounded-lg border px-4 py-3 ${
        isLight
          ? "border-[#feefc3] bg-[#fef7e0]"
          : "border-amber-500/25 bg-amber-500/5"
      }`}
    >
      <p className={`text-sm font-medium ${isLight ? "text-[#b06000]" : "text-amber-200"}`}>
        {accessCheck.headline}
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        {accessCheck.detail}
      </p>
      {accessCheck.suggestion && (
        <p className={`mt-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
          {accessCheck.suggestion}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 text-sm">
        <Link
          href="/platform/settings"
          className={`font-semibold hover:underline ${
            isLight ? "text-[#1a73e8]" : "text-emerald-400 hover:text-emerald-300"
          }`}
        >
          Settings
        </Link>
        {!gbpAccessVerified && businessId && (
          <>
            <span className={isLight ? "text-[#dadce0]" : "text-slate-600"}>·</span>
            <a
              href={reconnectHref}
              className={`font-semibold hover:underline ${
                isLight ? "text-[#1a73e8]" : "text-emerald-400 hover:text-emerald-300"
              }`}
            >
              Reconnect Google Business Profile
            </a>
          </>
        )}
      </div>
    </div>
  );
}
