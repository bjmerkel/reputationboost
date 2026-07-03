"use client";

import Link from "next/link";
import type { GbpLocationAccessCheck } from "@/lib/google/gbp-access";
import { isPerformancePermissionError } from "@/lib/google/performance-errors";

function roleLabel(role?: string): string {
  if (!role) return "Manager";
  return role.replace(/_/g, " ").toLowerCase();
}

export function PerformanceAccessDetails({
  accessCheck,
}: {
  accessCheck: GbpLocationAccessCheck;
}) {
  const managerAdmins = accessCheck.admins.filter(
    (admin) =>
      admin.role === "PRIMARY_OWNER" ||
      admin.role === "OWNER" ||
      admin.role === "MANAGER"
  );

  return (
    <div className="mt-3 space-y-2 text-sm text-slate-400">
      {accessCheck.platformEmail && (
        <p>
          Signed in to Reputation Boost:{" "}
          <span className="text-slate-300">{accessCheck.platformEmail}</span>
        </p>
      )}
      {accessCheck.googleAccountEmail && (
        <p>
          Google Business Profile authorized via:{" "}
          <span className="text-slate-300">{accessCheck.googleAccountEmail}</span>
          {accessCheck.gbpAccessVerified && (
            <span className="text-emerald-400"> · Manager access verified</span>
          )}
          {!accessCheck.gbpAccessVerified && accessCheck.matchedRole && (
            <>
              {" "}
              · <span className="text-slate-300">{roleLabel(accessCheck.matchedRole)}</span>
            </>
          )}
        </p>
      )}
      {accessCheck.accountMismatch && accessCheck.gbpAccessVerified && (
        <p className="text-slate-400">
          App sign-in and GBP account differ — that is expected when an agency Manager connects GBP.
        </p>
      )}
      {managerAdmins.length > 0 && (
        <details className="rounded-lg border border-white/8 bg-black/10 px-3 py-2">
          <summary className="cursor-pointer text-slate-300">
            Location managers ({managerAdmins.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {managerAdmins.slice(0, 8).map((admin, index) => (
              <li key={`${admin.email ?? admin.displayName ?? "admin"}-${index}`}>
                {(admin.email ?? admin.displayName ?? "Unknown admin") +
                  ` · ${roleLabel(admin.role)}`}
                {admin.pendingInvitation ? " (pending)" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function PerformancePermissionBanner({
  error,
  accessCheck,
  businessId,
}: {
  error?: string;
  accessCheck?: GbpLocationAccessCheck;
  businessId?: string;
}) {
  if (!accessCheck && (!error || !isPerformancePermissionError(error))) return null;

  const severity = accessCheck?.severity ?? "warning";
  const headline = accessCheck?.headline ?? "Performance metrics unavailable";
  const detail = accessCheck?.detail ?? error;
  const suggestion = accessCheck?.suggestion;

  const reconnectHref = businessId
    ? `/api/google/gbp/connect?businessId=${businessId}`
    : "/platform/settings";

  const containerClass =
    severity === "info"
      ? "rounded-xl border border-slate-500/25 bg-slate-500/10 px-5 py-4"
      : "rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4";

  const titleClass =
    severity === "info" ? "text-sm font-medium text-slate-200" : "text-sm font-medium text-amber-200";

  return (
    <div className={containerClass}>
      <p className={titleClass}>{headline}</p>
      {detail && <p className="mt-1 text-sm text-slate-400">{detail}</p>}
      {suggestion && <p className="mt-2 text-sm text-slate-300">{suggestion}</p>}
      {accessCheck && <PerformanceAccessDetails accessCheck={accessCheck} />}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Link
          href="/platform/settings"
          className="font-semibold text-emerald-400 hover:text-emerald-300"
        >
          View access details in Settings
        </Link>
        {businessId && severity !== "info" && (
          <>
            <span className="text-slate-600">·</span>
            <a
              href={reconnectHref}
              className="font-semibold text-emerald-400 hover:text-emerald-300"
            >
              Reconnect with a different Google account
            </a>
          </>
        )}
      </div>
    </div>
  );
}
