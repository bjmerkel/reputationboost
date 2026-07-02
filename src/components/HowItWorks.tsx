const steps = [
  {
    step: "01",
    title: "Audit Your GBP",
    description:
      "Connect your Google Business Profile and target keywords. We instantly analyze your current Maps rankings, review strength, and competitor positions.",
  },
  {
    step: "02",
    title: "Get Your Action Plan",
    description:
      "Receive AI-driven recommendations prioritized to move you into the Local 3-Pack — profile optimizations, review strategies, and keyword targets.",
  },
  {
    step: "03",
    title: "Rank Higher & Engage More",
    description:
      "Implement changes, track your climb on Google Maps, and watch calls, direction requests, and website clicks grow as you break into the top 3.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            How It Works
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            From invisible to{" "}
            <span className="gradient-text">Local 3-Pack</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Three steps to optimize your Google Business Profile and start
            capturing the 70%+ of map clicks that go to the top three.
          </p>
        </div>

        <div className="relative mt-16">
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-emerald-500/50 via-cyan-500/30 to-transparent lg:block" />

          <div className="grid gap-12 lg:grid-cols-3">
            {steps.map((item, index) => (
              <div key={item.step} className="relative text-center lg:text-left">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl font-bold text-emerald-400 lg:mx-0">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-white">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-slate-400">
                  {item.description}
                </p>

                {index < steps.length - 1 && (
                  <div className="mx-auto mt-8 flex justify-center lg:hidden">
                    <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-2">
          <div className="gradient-border overflow-hidden rounded-2xl">
            <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-8">
              <div className="mb-4 inline-flex rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">
                Before
              </div>
              <h4 className="text-lg font-bold text-white">Outside the Local 3-Pack</h4>
              <p className="mt-2 text-sm text-slate-400">
                Ranked position 4 or lower — missing 70–75% of map clicks and
                losing high-intent customers to competitors above you.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  { pos: 18, kw: "san diego stucco", label: "Not in pack" },
                  { pos: 24, kw: "stucco repair", label: "Not in pack" },
                  { pos: 31, kw: "exterior plaster", label: "Not in pack" },
                ].map((r) => (
                  <div
                    key={r.kw}
                    className="flex items-center justify-between rounded-lg bg-red-500/5 px-4 py-2.5"
                  >
                    <span className="text-sm text-slate-400">{r.kw}</span>
                    <span className="text-xs font-medium text-red-400">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gradient-border overflow-hidden rounded-2xl">
            <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-8">
              <div className="mb-4 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                After
              </div>
              <h4 className="text-lg font-bold text-white">In the Local 3-Pack</h4>
              <p className="mt-2 text-sm text-slate-400">
                Top-3 Google Maps positions driving 126% more traffic and 93%
                more calls and direction requests.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  { pos: 1, kw: "san diego stucco", label: "Map #1" },
                  { pos: 2, kw: "stucco repair", label: "Map #2" },
                  { pos: 1, kw: "exterior plaster", label: "Map #1" },
                ].map((r) => (
                  <div
                    key={r.kw}
                    className="flex items-center justify-between rounded-lg bg-emerald-500/5 px-4 py-2.5"
                  >
                    <span className="text-sm text-slate-400">{r.kw}</span>
                    <span className="text-xs font-medium text-emerald-400">{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
