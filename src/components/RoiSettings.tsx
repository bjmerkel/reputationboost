"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/audit/attribution/roi";
import { markPlanRefreshAfterAcvSave } from "@/components/results/results-focus";

export default function RoiSettings({
  businessId,
  initialValue,
  currency = "USD",
}: {
  businessId: string;
  initialValue: number | null;
  currency?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [savedValue, setSavedValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const parsed = value.trim() === "" ? null : Number(value.replace(/[^0-9.]/g, ""));
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      setError("Enter a valid dollar amount.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, avgCustomerValue: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      setSavedValue(parsed);
      setSaved(true);
      if (parsed != null && parsed > 0) {
        markPlanRefreshAfterAcvSave();
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-[#202124]">ROI estimates</h2>
      <p className="mt-2 text-sm text-[#5f6368]">
        We translate calls and direction requests into estimated revenue on your Results tab.
        A rough average is fine.
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-[#3c4043]">Average customer value</span>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 350"
              className="w-full rounded-lg border border-[#dadce0] py-2.5 pl-7 pr-3 text-sm text-[#202124] outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
            />
          </div>
        </label>

        {savedValue != null && savedValue > 0 && (
          <p className="text-sm text-[#137333]">
            Currently using {formatCurrency(savedValue, currency)} per converted customer.
          </p>
        )}

        {error && <p className="text-sm text-[#d93025]">{error}</p>}
        {saved && (
          <div className="space-y-1 text-sm text-[#137333]">
            <p>Saved. Dollar estimates are ready on Plan.</p>
            <p className="text-[#5f6368]">
              Open Plan to refresh step order for $/mo impact — it won&apos;t wait on the nightly
              reconcile.
            </p>
            <Link
              href="/platform/audit?view=strategy"
              className="inline-flex text-xs font-semibold text-[#1a73e8] hover:underline"
            >
              Open Plan and refresh order →
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save customer value"}
        </button>
      </form>
    </div>
  );
}
