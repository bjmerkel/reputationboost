"use client";

import RankingMap from "@/components/platform/RankingMap";

/** Full-bleed empty state — real map, no fake business data. */
export default function PlatformWelcome() {
  return (
    <div className="platform-theme google-maps-frame relative overflow-hidden bg-white">
      <div className="flex h-[min(88vh,900px)] min-h-[520px] flex-col-reverse overflow-hidden lg:flex-row">
        {/* Left panel placeholder */}
        <div className="flex w-full shrink-0 flex-col border-[#dadce0] bg-white lg:w-[408px] lg:border-r">
          <div className="border-b border-[#dadce0] px-5 py-6">
            <div className="h-32 animate-pulse rounded-lg bg-[#e8eaed]" />
            <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-[#e8eaed]" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[#e8eaed]" />
          </div>

          <div className="flex border-b border-[#dadce0]">
            {["Home", "Plan", "Reviews", "Results"].map((tab) => (
              <div
                key={tab}
                className="flex-1 border-b-2 border-transparent px-3 py-3 text-center text-xs text-[#9aa0a6] sm:text-sm"
              >
                {tab}
              </div>
            ))}
          </div>

          <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center lg:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f0fe]">
              <svg
                className="h-7 w-7 text-[#1a73e8]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </div>
            <h3 className="mt-5 text-xl font-normal text-[#202124]">
              Your Google Business Profile lives here
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#5f6368]">
              Search your business above. We&apos;ll load your real listing — score,
              keyword rankings on the map, 16-step plan, and what customers see on
              Google.
            </p>
            <a
              href="#hero-search"
              className="btn-primary mt-6 inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white"
            >
              Find my business
            </a>
          </div>
        </div>

        {/* Map canvas */}
        <div className="relative min-h-[280px] flex-1">
          <RankingMap
            lat={39.8283}
            lng={-98.5795}
            address="United States"
            businessName=""
            disableGridFetch
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/10" />
          <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
            <p className="rounded-full border border-[#dadce0] bg-white/95 px-4 py-2 text-sm text-[#5f6368] shadow-sm">
              Your keyword rankings and competitors appear on this map
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
