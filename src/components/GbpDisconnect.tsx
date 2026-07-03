"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GbpDisconnectProps {
  businessId: string;
  businessName: string;
  connectedAt: string | null;
  googleEmail?: string | null;
  variant?: "dark" | "light";
}

export default function GbpDisconnect({
  businessId,
  businessName,
  connectedAt,
  googleEmail,
  variant = "dark",
}: GbpDisconnectProps) {
  const isLight = variant === "light";
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/google/gbp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to disconnect");

      router.push(`/platform/onboard?businessId=${businessId}&disconnected=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div
      className={`rounded-xl border p-6 ${
        isLight ? "border-[#dadce0] bg-white shadow-sm" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <h2 className={`text-lg font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
        Google Business Profile
      </h2>
      <p className={`mt-2 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Location: <span className={isLight ? "text-[#3c4043]" : "text-slate-200"}>{businessName}</span>
        {googleEmail && (
          <>
            <br />
            Google account:{" "}
            <span className={isLight ? "text-[#3c4043]" : "text-slate-200"}>{googleEmail}</span>
          </>
        )}
        {connectedAt && (
          <span className={isLight ? "text-[#80868b]" : "text-slate-500"}>
            {" "}
            · connected {new Date(connectedAt).toLocaleDateString()}
          </span>
        )}
      </p>

      <div
        className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
          isLight
            ? "border-[#ceead6] bg-[#e6f4ea] text-[#137333]"
            : "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/90"
        }`}
      >
        Live GBP data, audits, and execution queue require an active connection.
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`mt-6 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
            isLight
              ? "border-[#f6aea9] bg-[#fce8e6] text-[#c5221f] hover:bg-[#f9dedc]"
              : "border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-500/50 hover:bg-red-500/15"
          }`}
        >
          Disconnect Google Business Profile
        </button>
      ) : (
        <div
          className={`mt-6 rounded-xl border p-4 ${
            isLight
              ? "border-[#f6aea9] bg-[#fce8e6]"
              : "border-red-500/30 bg-red-500/5"
          }`}
        >
          <p className={`text-sm font-medium ${isLight ? "text-[#c5221f]" : "text-red-200"}`}>
            Disconnect Google Business Profile?
          </p>
          <p className={`mt-2 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            This revokes access tokens, clears your GBP location link, and stops live data
            collection. Your business profile and audit history are kept — you can reconnect
            anytime.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              {loading ? "Disconnecting…" : "Yes, disconnect"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={loading}
              className={`rounded-full border px-5 py-2 text-sm font-medium transition disabled:opacity-50 ${
                isLight
                  ? "border-[#dadce0] text-[#3c4043] hover:bg-[#f8f9fa]"
                  : "border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className={`mt-4 text-sm ${isLight ? "text-[#d93025]" : "text-red-400"}`}>{error}</p>
      )}
    </div>
  );
}
