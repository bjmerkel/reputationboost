"use client";

import { useCallback, useState } from "react";
import type { PreviewAuditResult } from "@/audit/preview-audit";
import GoogleBusinessAutocomplete, {
  type BusinessPlaceSelection,
} from "@/components/GoogleBusinessAutocomplete";
import { usePreviewAudit } from "@/context/PreviewAuditContext";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

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
    <>
      <div id="hero-search" className="animate-fade-up animate-delay-300 mt-8 w-full max-w-2xl scroll-mt-24">
        <GoogleBusinessAutocomplete
          theme="light"
          compact
          onSelect={handleSelect}
          onClear={handleClear}
        />
        <p className="mt-3 text-sm text-[#80868b]">
          Your full audit loads below — score, map rankings, plan, and reviews.
        </p>
      </div>

      <div className="animate-fade-up animate-delay-300 mt-6 flex flex-col items-center gap-3 sm:flex-row">
        <a
          href={SIGNUP_URL}
          className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-white"
        >
          {SIGNUP_CTA_LABEL}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
        <a
          href="#how-it-works"
          className="btn-secondary inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-medium"
        >
          See How It Works
        </a>
      </div>

      {error && (
        <div className="mt-4 w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="animate-fade-up animate-delay-300 mt-4 text-sm text-[#80868b]">
        No credit card · 3-minute setup · Real GBP data
      </p>

      <div className="animate-fade-up animate-delay-400 mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {[
          {
            value: "70–75%",
            label: "of map clicks go to the top 3",
            sub: "Miss the pack, miss the customers",
          },
          {
            value: "+93%",
            label: "more calls & directions",
            sub: "When you break into the Local 3-Pack",
          },
          {
            value: "+$4,200",
            label: "avg. monthly revenue gain",
            sub: "After completing your action plan",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] px-4 py-5 text-center"
          >
            <div className="text-3xl font-medium text-[#1a73e8] sm:text-4xl">{stat.value}</div>
            <div className="mt-2 text-sm font-medium text-[#202124]">{stat.label}</div>
            <div className="mt-1 text-xs text-[#80868b]">{stat.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
