"use client";

import { useCallback, useEffect, useState } from "react";
import type { GbpNotificationCoverage } from "@/audit/types";

interface NotificationsProbe {
  coverage?: GbpNotificationCoverage;
  envPubsubTopic?: string | null;
  canAutoConfigure?: boolean;
  enabledSummary?: string;
  error?: string;
}

export default function GbpNotificationsSetup({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";
  const [probe, setProbe] = useState<NotificationsProbe | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/google/gbp/notifications");
      const data = await res.json();
      if (!res.ok) {
        setProbe({ error: data.error ?? "Failed to load notification settings" });
      } else {
        setProbe(data);
      }
    } catch {
      setProbe({ error: "Failed to load notification settings" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (action: "enable_recommended" | "clear") => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/google/gbp/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setProbe(data);
      setMessage(
        action === "clear"
          ? "Real-time alerts disabled on your GBP account."
          : "Recommended real-time alerts enabled."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const coverage = probe?.coverage;
  const configured = coverage?.configured ?? false;
  const canConfigure = probe?.canAutoConfigure ?? false;

  return (
    <div
      className={`rounded-xl border p-6 shadow-sm ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Real-time GBP alerts
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Pub/Sub notifications for reviews, Google edits, customer media, and listing status changes.
          </p>
        </div>
        {!loading && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              configured
                ? "bg-[#e6f4ea] text-[#137333]"
                : "bg-[#fef7e0] text-[#e37400]"
            }`}
          >
            {configured ? `Active · ${coverage?.coverageScore ?? 0}%` : "Not configured"}
          </span>
        )}
      </div>

      {loading ? (
        <p className={`mt-4 text-sm ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>Checking…</p>
      ) : probe?.error ? (
        <p className="mt-4 text-sm text-[#d93025]">{probe.error}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {coverage && (
            <dl className={`space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              <div className="flex justify-between gap-4">
                <dt className={isLight ? "text-[#80868b]" : "text-slate-500"}>Pub/Sub topic</dt>
                <dd className="text-right break-all">
                  {coverage.pubsubTopic || probe?.envPubsubTopic || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className={isLight ? "text-[#80868b]" : "text-slate-500"}>Subscribed events</dt>
                <dd className="text-right">{probe?.enabledSummary || "None"}</dd>
              </div>
              {coverage.missingRecommendedTypes.length > 0 && configured && (
                <div>
                  <dt className={isLight ? "text-[#80868b]" : "text-slate-500"}>Missing alerts</dt>
                  <dd className="mt-1 text-amber-600">
                    {coverage.missingRecommendedTypes
                      .map((t) => t.replace(/_/g, " ").toLowerCase())
                      .join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {!canConfigure && !configured && (
            <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              Set <code className="text-xs">GBP_PUBSUB_TOPIC</code> on the server to enable one-click
              alert setup. Grant publish access to{" "}
              <code className="text-xs">mybusiness-api-pubsub@system.gserviceaccount.com</code> on that topic.
            </p>
          )}

          {message && (
            <p className={`text-sm ${message.includes("failed") ? "text-[#d93025]" : "text-[#137333]"}`}>
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {canConfigure && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void runAction("enable_recommended")}
                className="btn-primary rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actionLoading ? "Updating…" : configured ? "Sync recommended alerts" : "Enable recommended alerts"}
              </button>
            )}
            {configured && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void runAction("clear")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                  isLight
                    ? "border-[#dadce0] text-[#3c4043] hover:bg-[#f8f9fa]"
                    : "border-white/12 text-slate-300 hover:bg-white/5"
                }`}
              >
                Disable alerts
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
