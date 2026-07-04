"use client";

import { useCallback, useState } from "react";
import type { PreviewAuditResult } from "@/audit/preview-audit";
import GoogleBusinessAutocomplete, {
  type BusinessPlaceSelection,
} from "@/components/GoogleBusinessAutocomplete";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

function gradeColor(grade: string): string {
  if (grade === "healthy") return "#188038";
  if (grade === "urgent") return "#d93025";
  return "#e37400";
}

function gradeLabel(grade: string): string {
  if (grade === "healthy") return "Healthy";
  if (grade === "urgent") return "Urgent";
  return "At risk";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRank(
  inLocalPack: boolean,
  position: number | "not_in_pack",
  rank: number | null
): string {
  if (inLocalPack && typeof position === "number") return `#${position}`;
  if (rank != null) return `#${rank}`;
  return "Not in pack";
}

function DemoDashboard({ dimmed = true }: { dimmed?: boolean }) {
  const keywords = [
    { keyword: "emergency plumber austin", rank: 8, inPack: false },
    { keyword: "water heater repair", rank: 3, inPack: true },
    { keyword: "drain cleaning near me", rank: 5, inPack: false },
  ];
  const planSteps = [
    { title: "Add 15 service photos", impact: 8 },
    { title: "Optimize business description", impact: 6 },
    { title: "Publish weekly Google Post", impact: 5 },
  ];

  return (
    <div className={dimmed ? "opacity-40" : ""}>
      <div className="grid lg:grid-cols-5">
        <div className="border-b border-[#dadce0] p-5 lg:col-span-2 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            How am I doing?
          </p>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#e37400] text-lg font-bold text-[#e37400]">
              47
            </div>
            <div>
              <p className="text-lg font-semibold text-[#202124]">Reputation Boost Score 47/100</p>
              <p className="text-sm text-[#5f6368]">Profile 52 · outcome 38</p>
              <p className="text-sm text-[#e37400]">At risk</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-[#dadce0] bg-[#f8f9fa] p-3">
            <p className="text-xs font-medium text-[#80868b]">Path to 70</p>
            <p className="mt-1 text-sm font-semibold text-[#202124]">
              47 → <span className="text-[#188038]">72</span>
            </p>
            <p className="mt-1 text-xs font-medium text-[#188038]">+$4,200/mo estimated revenue</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8eaed]">
              <div className="h-full w-[65%] rounded-full bg-[#007b83]" />
            </div>
          </div>
        </div>

        <div className="border-b border-[#dadce0] p-5 lg:col-span-2 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            Keyword scores
          </p>
          <div className="mt-3 space-y-2">
            {keywords.map((item) => (
              <div
                key={item.keyword}
                className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-[#202124]">{item.keyword}</span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: item.inPack ? "#ceead6" : "#fce8e6",
                      color: item.inPack ? "#188038" : "#d93025",
                    }}
                  >
                    #{item.rank}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            Top actions
          </p>
          <div className="mt-3 space-y-2">
            {planSteps.map((step) => (
              <div
                key={step.title}
                className="flex items-center justify-between text-sm text-[#3c4043]"
              >
                <span className="min-w-0 truncate">{step.title}</span>
                <span className="shrink-0 font-semibold text-[#188038]">+{step.impact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LivePreviewDashboard({ preview }: { preview: PreviewAuditResult }) {
  const color = gradeColor(preview.score.grade);
  const progressPct = Math.min(
    100,
    Math.round((preview.score.overall / preview.pathToHealthy.projectedScore) * 100)
  );

  return (
    <div>
      <div className="border-b border-[#dadce0] bg-[#e8f0fe] px-4 py-2">
        <p className="text-xs font-medium text-[#1a73e8]">
          Live preview for {preview.business.name}
        </p>
      </div>

      <div className="grid lg:grid-cols-5">
        <div className="border-b border-[#dadce0] p-5 lg:col-span-2 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            How am I doing?
          </p>
          <div className="mt-4 flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 text-lg font-bold"
              style={{ borderColor: color, color }}
            >
              {preview.score.overall}
            </div>
            <div>
              <p className="text-lg font-semibold text-[#202124]">
                Reputation Boost Score {preview.score.overall}/100
              </p>
              <p className="text-sm text-[#5f6368]">
                Profile {preview.score.driverScore} · outcome {preview.score.outcomeIndex}
              </p>
              <p className="text-sm capitalize" style={{ color }}>
                {gradeLabel(preview.score.grade)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[#dadce0] bg-[#f8f9fa] p-3">
            <p className="text-xs font-medium text-[#80868b]">Path to 70</p>
            <p className="mt-1 text-sm font-semibold text-[#202124]">
              {preview.pathToHealthy.currentScore} →{" "}
              <span className="text-[#188038]">{preview.pathToHealthy.projectedScore}</span>
            </p>
            {preview.pathToHealthy.estimatedRevenueGain != null && (
              <p className="mt-1 text-xs font-medium text-[#188038]">
                +{formatCurrency(preview.pathToHealthy.estimatedRevenueGain)}/mo estimated revenue
              </p>
            )}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8eaed]">
              <div
                className="h-full rounded-full bg-[#007b83] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {preview.topGap && (
            <div className="mt-3 rounded-lg border border-[#fce8e6] bg-[#fef7f6] p-3">
              <p className="text-xs font-semibold text-[#d93025]">Top gap surfaced</p>
              <p className="mt-1 text-sm text-[#3c4043]">{preview.topGap.title}</p>
            </div>
          )}
        </div>

        <div className="border-b border-[#dadce0] p-5 lg:col-span-2 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            AI-picked keywords
          </p>
          <div className="mt-3 space-y-2">
            {preview.keywords.map((item) => (
              <div
                key={item.keyword}
                className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-[#202124]">{item.keyword}</span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: item.inLocalPack ? "#ceead6" : "#fce8e6",
                      color: item.inLocalPack ? "#188038" : "#d93025",
                    }}
                  >
                    {formatRank(item.inLocalPack, item.localPackPosition, item.rank)}
                  </span>
                </div>
                {!item.inLocalPack && item.packLeaderReviewCount > 0 && (
                  <p className="mt-1 text-xs text-[#80868b]">
                    Pack leader has {item.packLeaderReviewCount} reviews
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
            Top actions
          </p>
          <div className="mt-3 space-y-2">
            {preview.pathToHealthy.topActions.length > 0 ? (
              preview.pathToHealthy.topActions.map((step) => (
                <div
                  key={step.title}
                  className="flex items-center justify-between gap-2 text-sm text-[#3c4043]"
                >
                  <span className="min-w-0 truncate">{step.title}</span>
                  <span className="shrink-0 font-semibold text-[#188038]">
                    +{step.scoreImpact}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#5f6368]">Your profile looks strong — get the full audit for deeper insights.</p>
            )}
          </div>

          <a
            href={SIGNUP_URL}
            className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white"
          >
            {SIGNUP_CTA_LABEL}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="grid lg:grid-cols-5">
      {[2, 2, 1].map((span, col) => (
        <div
          key={col}
          className={`animate-pulse border-b border-[#dadce0] p-5 lg:border-b-0 ${
            col < 2 ? "lg:border-r" : ""
          } ${span === 2 ? "lg:col-span-2" : ""}`}
        >
          <div className="h-3 w-24 rounded bg-[#e8eaed]" />
          <div className="mt-6 flex gap-4">
            <div className="h-16 w-16 rounded-full bg-[#e8eaed]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-full rounded bg-[#e8eaed]" />
              <div className="h-3 w-2/3 rounded bg-[#e8eaed]" />
              <div className="h-3 w-1/3 rounded bg-[#e8eaed]" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-16 rounded-lg bg-[#e8eaed]" />
            <div className="h-16 rounded-lg bg-[#e8eaed]" />
          </div>
        </div>
      ))}
      <div className="col-span-full border-t border-[#dadce0] bg-[#f8f9fa] px-4 py-3 text-center">
        <p className="text-sm text-[#5f6368]">
          Auditing your profile, AI-picking keywords, and checking Local 3-Pack rankings…
        </p>
      </div>
    </div>
  );
}

export default function HeroBusinessSearch() {
  const [preview, setPreview] = useState<PreviewAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<BusinessPlaceSelection | null>(null);

  const runPreview = useCallback(async (place: BusinessPlaceSelection) => {
    setLoading(true);
    setError(null);
    setPreview(null);

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

      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview audit failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = useCallback(
    (place: BusinessPlaceSelection) => {
      setSelectedPlace(place);
      void runPreview(place);
    },
    [runPreview]
  );

  const handleClear = useCallback(() => {
    setSelectedPlace(null);
    setPreview(null);
    setError(null);
  }, []);

  return (
    <>
      <div className="animate-fade-up animate-delay-300 mt-8 w-full max-w-2xl">
        <GoogleBusinessAutocomplete
          theme="light"
          compact
          onSelect={handleSelect}
          onClear={handleClear}
        />
        <p className="mt-3 text-sm text-[#80868b]">
          Select your listing — we&apos;ll show your score, keywords, and top gaps instantly.
        </p>
      </div>

      {!selectedPlace && (
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
      )}

      {error && (
        <div className="mt-4 w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="animate-fade-up animate-delay-300 mt-4 text-sm text-[#80868b]">
        No credit card · 3-minute setup · Real GBP data
      </p>

      <div className="animate-fade-up animate-delay-400 mt-12 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
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

      <div className="animate-fade-up animate-delay-400 relative mx-auto mt-14 w-full max-w-5xl">
        <div className="maps-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#dadce0] bg-[#f8f9fa] px-4 py-2.5">
            <span className="text-xs font-medium text-[#5f6368]">
              Reputation Boost · {preview ? "Your Preview" : "Dashboard"}
            </span>
            {loading && (
              <span className="ml-auto text-xs text-[#1a73e8]">Analyzing…</span>
            )}
          </div>

          {loading && <LoadingDashboard />}
          {!loading && preview && <LivePreviewDashboard preview={preview} />}
          {!loading && !preview && <DemoDashboard dimmed={!selectedPlace} />}
        </div>

        {preview && !loading && (
          <div className="absolute -right-2 -top-3 hidden rounded-lg border border-[#dadce0] bg-white px-4 py-3 shadow-sm lg:block">
            <p className="text-sm font-medium text-[#188038]">
              {preview.pathToHealthy.pointsNeeded > 0
                ? `${preview.pathToHealthy.pointsNeeded} pts to healthy`
                : "Already healthy"}
            </p>
            <p className="text-xs text-[#5f6368]">Based on live Maps data</p>
          </div>
        )}
      </div>
    </>
  );
}
