import Link from "next/link";
import type { AdminAlert } from "@/lib/admin/alerts";

function severityStyles(severity: AdminAlert["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-red-500/30 bg-red-500/10";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10";
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10";
    case "info":
      return "border-slate-500/30 bg-slate-500/10";
  }
}

function severityLabel(severity: AdminAlert["severity"]): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    case "success":
      return "Positive";
    case "info":
      return "Info";
  }
}

export default function AlertFeed({ alerts }: { alerts: AdminAlert[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-[#64748b]">No active alerts right now.</p>;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Link
          key={alert.id}
          href={alert.href}
          className={`block rounded-lg border p-4 transition-colors hover:brightness-110 ${severityStyles(alert.severity)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-white">{alert.title}</p>
              <p className="mt-1 text-sm text-[#cbd5e1]">{alert.detail}</p>
            </div>
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
              {severityLabel(alert.severity)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
