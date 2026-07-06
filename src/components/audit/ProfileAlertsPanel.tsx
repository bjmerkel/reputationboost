"use client";

import type { GbpEvent } from "@/audit/types/gbp-events";

const SEVERITY_STYLES: Record<
  GbpEvent["severity"],
  { badge: string; border: string; title: string }
> = {
  critical: {
    badge: "bg-[#fce8e6] text-[#c5221f]",
    border: "border-[#fce8e6]",
    title: "text-[#c5221f]",
  },
  warning: {
    badge: "bg-[#fef7e0] text-[#b06000]",
    border: "border-[#fef7e0]",
    title: "text-[#b06000]",
  },
  info: {
    badge: "bg-[#e8f0fe] text-[#1a73e8]",
    border: "border-[#e8eaed]",
    title: "text-[#1a73e8]",
  },
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ProfileAlertsPanel({
  events,
  loading = false,
  error = null,
  variant = "light",
  onNavigateToPlan,
  onDismiss,
}: {
  events: GbpEvent[];
  loading?: boolean;
  error?: string | null;
  variant?: "light" | "dark";
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: "google-updates") => void;
  onDismiss?: (eventId: string) => void;
}) {
  const isLight = variant === "light";

  if (loading) {
    return (
      <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Loading profile alerts…
      </p>
    );
  }

  if (error) {
    return (
      <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Alerts unavailable right now. Run a new audit or check back after nightly sync.
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className={`rounded-lg border px-3 py-2.5 ${
          isLight ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-white/[0.02]"
        }`}
      >
        <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
          No active profile alerts. Nightly sync and Google Pub/Sub will surface conflicts,
          moderation holds, and new reviews here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const styles = SEVERITY_STYLES[event.severity];
        return (
          <div
            key={event.id}
            className={`rounded-lg border px-3 py-3 ${isLight ? styles.border : "border-white/8"} ${
              isLight ? "bg-white" : "bg-white/[0.02]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles.badge}`}>
                    {event.severity}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wide ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                    {event.source}
                  </span>
                </div>
                <p className={`mt-1 text-sm font-semibold ${isLight ? styles.title : "text-white"}`}>
                  {event.title}
                </p>
                <p className={`mt-1 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
                  {event.message}
                </p>
                <p className={`mt-1 text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
                  {formatWhen(event.detectedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {event.planStepNumber != null && onNavigateToPlan && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToPlan(
                        event.planStepNumber!,
                        event.planScrollTarget ?? undefined
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isLight
                        ? "bg-[#1a73e8] text-white hover:bg-[#1765cc]"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                  >
                    Fix in plan
                  </button>
                )}
                {onDismiss && (
                  <button
                    type="button"
                    onClick={() => onDismiss(event.id)}
                    className={`text-xs font-medium hover:underline ${
                      isLight ? "text-[#5f6368]" : "text-slate-400"
                    }`}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
