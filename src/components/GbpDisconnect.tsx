"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GbpDisconnectProps {
  businessId: string;
  businessName: string;
  connectedAt: string | null;
  googleEmail?: string | null;
}

export default function GbpDisconnect({
  businessId,
  businessName,
  connectedAt,
  googleEmail,
}: GbpDisconnectProps) {
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
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <h2 className="text-lg font-bold text-white">Google Business Profile</h2>
      <p className="mt-2 text-sm text-slate-400">
        Location: <span className="text-slate-200">{businessName}</span>
        {googleEmail && (
          <>
            <br />
            Google account: <span className="text-slate-200">{googleEmail}</span>
          </>
        )}
        {connectedAt && (
          <span className="text-slate-500">
            {" "}
            · connected {new Date(connectedAt).toLocaleDateString()}
          </span>
        )}
      </p>

      <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200/90">
        Live GBP data, audits, and execution queue require an active connection.
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-6 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:border-red-500/50 hover:bg-red-500/15"
        >
          Disconnect Google Business Profile
        </button>
      ) : (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-red-200">Disconnect Google Business Profile?</p>
          <p className="mt-2 text-sm text-slate-400">
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
              className="rounded-full border border-white/10 px-5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
