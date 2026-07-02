import { SIGNUP_URL } from "@/lib/constants";

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
            AI-Powered Local Rankings Platform
          </div>

          <h1 className="animate-fade-up animate-delay-100 max-w-4xl text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Enhance Your{" "}
            <span className="gradient-text">Online Presence</span>
          </h1>

          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Discover where your business stands, get an AI-driven action plan,
            and learn how to outrank competitors and improve your visibility.
          </p>

          <div className="animate-fade-up animate-delay-300 mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href={SIGNUP_URL}
              className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
            >
              Get Free Account
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="#features"
              className="btn-secondary inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
            >
              Explore Features
            </a>
          </div>

          <div className="animate-fade-up animate-delay-400 mt-16 grid w-full max-w-3xl grid-cols-3 gap-8 border-t border-white/10 pt-10">
            {[
              { value: "10K+", label: "Businesses Tracked" },
              { value: "4.9★", label: "Average Rating" },
              { value: "3x", label: "Avg. Visibility Boost" },
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
                <span className="ml-3 text-xs text-slate-500">Rankings Dashboard</span>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Keyword Rankings
                  </div>
                  {[
                    { keyword: "plumber near me", rank: 2, change: "+5" },
                    { keyword: "emergency plumbing", rank: 4, change: "+3" },
                    { keyword: "water heater repair", rank: 1, change: "+8" },
                  ].map((item) => (
                    <div
                      key={item.keyword}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3"
                    >
                      <span className="text-sm text-slate-300">{item.keyword}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-white">#{item.rank}</span>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          {item.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Geo Heatmap Preview
                  </div>
                  <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-800 to-slate-900">
                    <div className="absolute inset-0 opacity-30">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute rounded-full border border-emerald-500/30"
                          style={{
                            width: `${(i + 1) * 60}px`,
                            height: `${(i + 1) * 60}px`,
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      ))}
                    </div>
                    <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50">
                      <div className="h-3 w-3 rounded-full bg-white" />
                    </div>
                    <div className="absolute bottom-3 left-3 flex gap-2 text-xs text-slate-400">
                      <span className="rounded bg-white/10 px-2 py-1">1 mi</span>
                      <span className="rounded bg-white/10 px-2 py-1">3 mi</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-1 text-emerald-400">5 mi</span>
                      <span className="rounded bg-white/10 px-2 py-1">10 mi</span>
                    </div>
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
                <div className="text-sm font-semibold text-white">Rank Improved!</div>
                <div className="text-xs text-slate-400">+5 positions this week</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
