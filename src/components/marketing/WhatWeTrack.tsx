import SectionHeader from "@/components/marketing/SectionHeader";
import { SUPPORT_EMAIL } from "@/lib/constants";

const dashboardMetrics = [
  { label: "Reputation Boost Score", hint: "One number for listing + rankings" },
  { label: "Google Maps Rankings", hint: "Where you show up across your area" },
  { label: "Reviews", hint: "Count, rating, response rate" },
  { label: "Photos", hint: "Listing strength vs competitors" },
  { label: "Calls", hint: "Tracked from your Google listing" },
  { label: "Directions", hint: "How often people navigate to you" },
  { label: "Website Clicks", hint: "Traffic from Maps to your site" },
  { label: "Estimated Revenue", hint: "Dollars tied to ranking gains" },
  { label: "Top Keyword", hint: "Your highest-value search term" },
  { label: "Biggest Opportunity", hint: "The fix that moves the needle most" },
  { label: "Cell experiments", hint: "Per-neighborhood tests vs local leaders" },
];

const illustrativeProof = {
  before: {
    score: 46,
    avgRank: "#9",
    revenue: "$2,300/mo",
  },
  after: {
    score: 82,
    avgRank: "#2",
    revenue: "$6,100/mo",
  },
};

export default function WhatWeTrack() {
  return (
    <section id="what-we-track" className="scroll-mt-28 border-b border-[#dadce0] bg-[#f8f9fa] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="What we track"
          labelColor="emerald"
          title={
            <>
              Your Google listing dashboard —{" "}
              <span className="gradient-text font-semibold">all in one place</span>
            </>
          }
          subtitle="Search your business above to see your live numbers. Here's everything the platform tracks for you."
        />

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {dashboardMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-[#dadce0] bg-white px-4 py-4 transition hover:border-[#1a73e8]/40 hover:shadow-sm"
            >
              <p className="text-sm font-semibold text-[#202124]">{metric.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#80868b]">{metric.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="rounded-full bg-[#fef7e0] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#e37400]">
              Illustrative example — not a client result
            </span>
          </div>

          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-sm">
            <div className="border-b border-[#dadce0] bg-[#f8f9fa] px-5 py-3 text-center text-sm font-medium text-[#5f6368]">
              Example: local HVAC business · 90-day improvement
            </div>

            <div className="grid sm:grid-cols-2">
              <div className="border-b border-[#dadce0] p-6 sm:border-b-0 sm:border-r">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
                  Before
                </p>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-xs text-[#80868b]">Score</dt>
                    <dd className="text-3xl font-semibold text-[#d93025]">
                      {illustrativeProof.before.score}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#80868b]">Average rank</dt>
                    <dd className="text-xl font-semibold text-[#202124]">
                      {illustrativeProof.before.avgRank}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#80868b]">Est. Maps revenue</dt>
                    <dd className="text-xl font-semibold text-[#202124]">
                      {illustrativeProof.before.revenue}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-[#e6f4ea]/40 p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#188038]">
                  90 days later
                </p>
                <dl className="mt-4 space-y-4">
                  <div>
                    <dt className="text-xs text-[#80868b]">Score</dt>
                    <dd className="text-3xl font-semibold text-[#188038]">
                      {illustrativeProof.after.score}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#80868b]">Average rank</dt>
                    <dd className="text-xl font-semibold text-[#202124]">
                      {illustrativeProof.after.avgRank}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#80868b]">Est. Maps revenue</dt>
                    <dd className="text-xl font-semibold text-[#188038]">
                      {illustrativeProof.after.revenue}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-lg text-center text-sm text-[#80868b]">
            Your free audit shows where you stand today.{" "}
            <a href="#hero-search" className="text-[#1a73e8] hover:underline">
              Search your business
            </a>{" "}
            to see your real score and plan.
          </p>
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-[#80868b]">
          Have a story to share?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#1a73e8] hover:underline">
            Email us
          </a>{" "}
          — we only publish testimonials with written approval.
        </p>
      </div>
    </section>
  );
}
