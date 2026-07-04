"use client";

import { useCallback, useState } from "react";
import type { PreviewAuditResult } from "@/audit/preview-audit";
import GoogleBusinessAutocomplete, {
  type BusinessPlaceSelection,
} from "@/components/GoogleBusinessAutocomplete";
import { usePreviewAudit } from "@/context/PreviewAuditContext";

const searchPromises = [
  "Your Reputation Boost Score",
  "Your highest-value keywords",
  "What's holding your rankings back",
  "How much revenue you're losing",
  "Exactly what to fix first",
];

export default function HeroBusinessSearch() {
  const { setPreviewResult, setLoading: setContextLoading, setPendingSearch } =
    usePreviewAudit();
  const [error, setError] = useState<string | null>(null);

  const runPreview = useCallback(
    async (place: BusinessPlaceSelection) => {
      setContextLoading(true);
      setPendingSearch({
        name: place.name,
        industry: place.industry,
        location: {
          lat: place.lat,
          lng: place.lng,
          address: place.address,
        },
      });
      setError(null);
      setPreviewResult(null);

      document.getElementById("platform-explorer")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      try {
        const res = await fetch("/api/preview-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId: place.placeId,
            name: place.name,
            industry: place.industry,
            address: place.address,
            city: place.city,
            state: place.state,
            zip: place.zip,
            lat: place.lat,
            lng: place.lng,
            phone: place.phone,
            website: place.website,
          }),
        });

        const data = (await res.json()) as PreviewAuditResult & { error?: string };

        if (!res.ok) {
          throw new Error(data.error ?? "Preview audit failed");
        }

        setPreviewResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview audit failed");
        setPreviewResult(null);
        setPendingSearch(null);
      } finally {
        setContextLoading(false);
      }
    },
    [setPreviewResult, setContextLoading, setPendingSearch]
  );

  const handleSelect = useCallback(
    (place: BusinessPlaceSelection) => {
      void runPreview(place);
    },
    [runPreview]
  );

  const handleClear = useCallback(() => {
    setError(null);
    setPreviewResult(null);
    setPendingSearch(null);
  }, [setPreviewResult, setPendingSearch]);

  return (
    <div
      id="hero-search"
      className="animate-fade-up animate-delay-150 mt-8 w-full max-w-3xl scroll-mt-24 sm:mt-10"
    >
      <p className="mb-3 text-sm font-semibold text-[#1a73e8]">
        Get your Reputation Boost Score — free
      </p>

      <GoogleBusinessAutocomplete
        theme="light"
        hero
        onSelect={handleSelect}
        onClear={handleClear}
      />

      <div className="mt-6 rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-5 py-5 text-left">
        <p className="text-sm font-semibold text-[#202124]">
          Search your business to instantly discover:
        </p>
        <ul className="mt-3 space-y-2">
          {searchPromises.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-[#3c4043]">
              <span className="mt-0.5 text-[#1a73e8]" aria-hidden>
                •
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="mt-4 text-sm text-[#80868b]">
        No credit card · Takes about 3 minutes · Real Google listing data
      </p>
    </div>
  );
}
