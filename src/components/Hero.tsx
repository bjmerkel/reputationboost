import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

const keywords = [
  { keyword: "emergency plumber austin", rank: 8, revenue: "$2,400/mo at #1", inPack: false },
  { keyword: "water heater repair", rank: 3, revenue: "$1,850/mo at #1", inPack: true },
  { keyword: "drain cleaning near me", rank: 5, revenue: "$1,200/mo at #1", inPack: false },
];

const planSteps = [
  { title: "Add 15 service photos", impact: 8 },
  { title: "Optimize business description", impact: 6 },
  { title: "Publish weekly Google Post", impact: 5 },
];

export default function Hero() {
  return (
    <section className="border-b border-[#dadce0] bg-white pt-12 pb-16 lg:pt-16 lg:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[#d2e3fc] bg-[#e8f0fe] px-4 py-1.5 text-sm font-medium text-[#1a73e8]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1a73e8] opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1a73e8]" />
            </span>
            Free Reputation Boost Score Audit
          </div>

          <h1 className="animate-fade-up animate-delay-100 max-w-4xl text-4xl font-normal leading-tight tracking-tight text-[#202124] sm:text-5xl lg:text-6xl">
            Your Score. Your Plan.{" "}
            <span className="gradient-text font-semibold">Your Revenue.</span>
          </h1>

          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-lg leading-relaxed text-[#5f6368]">
            Find your business on Google Maps. We audit your profile, AI-pick your
            best Local 3-Pack keywords, calculate your Reputation Boost Score, and
            build a step-by-step plan to increase rankings, calls, and revenue.
          </p>

          <div className="animate-fade-up animate-delay-300 mt-8 flex flex-col gap-3 sm:flex-row">
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
        </div>

        <div className="animate-fade-up animate-delay-400 relative mx-auto mt-14 max-w-5xl">
          <div className="maps-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#dadce0] bg-[#f8f9fa] px-4 py-2.5">
              <span className="text-xs font-medium text-[#5f6368]">Reputation Boost · Dashboard</span>
            </div>

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
                    <p className="text-sm capitalize text-[#e37400]">At risk</p>
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
                      <p className="mt-1 text-xs text-[#188038]">{item.revenue}</p>
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
                <div className="relative mt-4 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-[#e8eaed]">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full border border-[#1a73e8]/30"
                      style={{
                        width: `${(i + 1) * 40}px`,
                        height: `${(i + 1) * 40}px`,
                      }}
                    />
                  ))}
                  <div className="relative z-10 h-3 w-3 rounded-full bg-[#1a73e8]" />
                  <span className="absolute bottom-2 left-2 text-[10px] text-[#80868b]">Geo heatmap</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -right-2 -top-3 hidden rounded-lg border border-[#dadce0] bg-white px-4 py-3 shadow-sm lg:block">
            <p className="text-sm font-medium text-[#188038]">+12 pts this month</p>
            <p className="text-xs text-[#5f6368]">Score trending up</p>
          </div>
        </div>
      </div>
    </section>
  );
}
