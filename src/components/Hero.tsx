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
    <section className="relative min-h-screen overflow-hidden pt-32 pb-20 lg:pt-40">
      <div className="mesh-bg absolute inset-0" />
      <div className="grid-pattern absolute inset-0 opacity-50" />

      <div className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center text-center">
          <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Free Reputation Boost Score Audit
          </div>

          <h1 className="animate-fade-up animate-delay-100 max-w-4xl text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Your Score. Your Plan.{" "}
            <span className="gradient-text">Your Revenue.</span>
          </h1>

          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Find your business on Google Maps. We audit your profile, AI-pick your
            best Local 3-Pack keywords, calculate your Reputation Boost Score, and
            build a step-by-step plan to increase rankings, calls, and revenue.
          </p>

          <div className="animate-fade-up animate-delay-300 mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href={SIGNUP_URL}
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
            >
              {SIGNUP_CTA_LABEL}
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="#how-it-works"
              className="btn-secondary inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
            >
              See How It Works
            </a>
          </div>

          <p className="animate-fade-up animate-delay-300 mt-4 text-sm text-slate-500">
            No credit card · 3-minute setup · Real GBP data
          </p>

          <div className="animate-fade-up animate-delay-400 mt-16 grid w-full max-w-3xl grid-cols-3 gap-8 border-t border-white/10 pt-10">
            {[
              { value: "16-step", label: "GBP Action Plan" },
              { value: "4 radii", label: "Geo-Grid Tracking" },
              { value: "$4,200", label: "Avg. Monthly Gain" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-white sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up animate-delay-400 relative mx-auto mt-20 max-w-5xl">
          <div className="gradient-border overflow-hidden rounded-2xl p-1">
            <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-slate-900/80">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-xs text-slate-500">Reputation Boost Dashboard</span>
              </div>

              <div className="grid gap-4 p-6 lg:grid-cols-3">
                <div className="space-y-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Reputation Boost Score
                  </div>
                  <div className="flex items-center gap-4 rounded-lg bg-white/5 p-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-orange-500 text-xl font-bold text-orange-400">
                      47
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">47/100</p>
                      <p className="text-xs text-slate-400">Profile 52 · Outcome 38</p>
                      <p className="mt-1 text-xs font-medium text-orange-400">At risk</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs font-medium text-slate-500">Path to 70</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      47 → <span className="text-emerald-400">72</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-emerald-400">
                      +$4,200/mo estimated revenue
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[65%] rounded-full bg-emerald-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Keyword Scores
                  </div>
                  {keywords.map((item) => (
                    <div
                      key={item.keyword}
                      className="rounded-lg bg-white/5 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-slate-300">{item.keyword}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.inPack
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          #{item.rank}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-emerald-400">{item.revenue}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Top Actions
                  </div>
                  {planSteps.map((step) => (
                    <div
                      key={step.title}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2.5"
                    >
                      <span className="text-sm text-slate-300">{step.title}</span>
                      <span className="text-xs font-semibold text-emerald-400">
                        +{step.impact} pts
                      </span>
                    </div>
                  ))}
                  <div className="relative mt-2 flex h-28 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 to-slate-900">
                    <div className="absolute inset-0 opacity-30">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute rounded-full border border-emerald-500/30"
                          style={{
                            width: `${(i + 1) * 50}px`,
                            height: `${(i + 1) * 50}px`,
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      ))}
                    </div>
                    <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50">
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                    <span className="absolute bottom-2 left-2 text-[10px] text-slate-500">
                      Geo heatmap
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="animate-float absolute -right-4 -top-4 hidden rounded-xl border border-white/10 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-sm lg:block">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">+12 pts this month</div>
                <div className="text-xs text-slate-400">Score trending up</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
