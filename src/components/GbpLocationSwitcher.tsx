"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RankedGbpLocation } from "@/lib/google/gbp-onboarding-match";

interface GbpLocationSwitcherProps {
  businessId: string;
  currentLocationId?: string | null;
}

export default function GbpLocationSwitcher({
  businessId,
  currentLocationId,
}: GbpLocationSwitcherProps) {
  const router = useRouter();
  const [locations, setLocations] = useState<RankedGbpLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/google/gbp/locations?businessId=${businessId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load locations");
        if (!cancelled) setLocations(data.locations ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load locations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLocations();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const current =
    locations.find((loc) => loc.locationId === currentLocationId) ??
    locations.find((loc) => loc.recommended);

  async function switchLocation(loc: RankedGbpLocation) {
    if (loc.locationId === currentLocationId) return;

    setSwitching(true);
    setError("");
    try {
      const res = await fetch("/api/google/gbp/select-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          accountId: loc.accountId,
          locationId: loc.locationId,
          placeId: loc.placeId,
          title: loc.title,
          phone: loc.phone,
          website: loc.website,
          industry: loc.primaryCategory,
          address: loc.address,
          parentChainId: loc.parentChainId,
          chainDisplayName: loc.chainDisplayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to switch location");
      router.refresh();
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch location");
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#202124]">GBP location</h2>
        <p className="mt-2 text-sm text-[#5f6368]">Loading managed locations…</p>
      </div>
    );
  }

  if (locations.length <= 1) {
    if (!current) return null;

    return (
      <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#202124]">GBP location</h2>
        <p className="mt-2 text-sm font-medium text-[#202124]">{current.title}</p>
        <p className="mt-1 text-sm text-[#5f6368]">{current.address}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#dadce0] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#202124]">GBP location</h2>
          <p className="mt-1 text-sm text-[#5f6368]">
            Your Google account manages {locations.length} locations. Switch which one this business
            optimizes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-full border border-[#dadce0] px-4 py-2 text-sm font-semibold text-[#3c4043] transition hover:bg-[#f8f9fa]"
        >
          {expanded ? "Hide locations" : "Switch location"}
        </button>
      </div>

      {current && (
        <div className="mt-4 rounded-lg border border-[#e8f0fe] bg-[#f8f9fa] p-4">
          <p className="text-sm font-medium text-[#202124]">Current: {current.title}</p>
          <p className="mt-1 text-sm text-[#5f6368]">{current.address}</p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-[#f6aea9] bg-[#fce8e6] px-4 py-3 text-sm text-[#c5221f]">
          {error}
        </p>
      )}

      {expanded && (
        <div className="mt-4 space-y-3">
          {locations.map((loc) => {
            const isCurrent = loc.locationId === currentLocationId;
            return (
              <button
                key={`${loc.accountId}-${loc.locationId}`}
                type="button"
                disabled={switching || isCurrent}
                onClick={() => switchLocation(loc)}
                className={`w-full rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                  isCurrent
                    ? "border-[#1a73e8] bg-[#e8f0fe]"
                    : "border-[#dadce0] hover:border-[#1a73e8] hover:bg-[#f8f9fa]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-[#202124]">{loc.title}</p>
                  {isCurrent ? (
                    <span className="shrink-0 rounded-full bg-[#1a73e8] px-2 py-0.5 text-xs font-medium text-white">
                      Active
                    </span>
                  ) : loc.recommended ? (
                    <span className="shrink-0 rounded-full bg-[#e8f0fe] px-2 py-0.5 text-xs font-medium text-[#1a73e8]">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[#5f6368]">{loc.address}</p>
                <p className="mt-1 text-xs text-[#80868b]">
                  {loc.primaryCategory}
                  {loc.chainDisplayName ? ` · ${loc.chainDisplayName} chain` : ""}
                  {loc.matchReason ? ` · ${loc.matchReason}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
