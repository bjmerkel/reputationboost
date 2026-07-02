const steps = [
  {
    step: "01",
    title: "Enter Your Business",
    description:
      "Add your business location and target keywords. Our AI instantly analyzes your current Google Maps presence.",
  },
  {
    step: "02",
    title: "Get Your AI Report",
    description:
      "Receive a comprehensive breakdown of your rankings, competitor positions, and a prioritized action plan.",
  },
  {
    step: "03",
    title: "Implement & Grow",
    description:
      "Follow AI-driven recommendations to optimize your profile, track progress, and watch your visibility soar.",
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
            From insight to action in{" "}
            <span className="gradient-text">three simple steps</span>
          </h2>
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
              <h4 className="text-lg font-bold text-white">Low Local Visibility</h4>
              <p className="mt-2 text-sm text-slate-400">
                Rankings scattered across the map with inconsistent positions and
                competitors dominating key search terms.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  { pos: 18, kw: "san diego stucco" },
                  { pos: 24, kw: "stucco repair" },
                  { pos: 31, kw: "exterior plaster" },
                ].map((r) => (
                  <div
                    key={r.kw}
                    className="flex items-center justify-between rounded-lg bg-red-500/5 px-4 py-2.5"
                  >
                    <span className="text-sm text-slate-400">{r.kw}</span>
                    <span className="font-bold text-red-400">#{r.pos}</span>
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
              <h4 className="text-lg font-bold text-white">Top Local Rankings</h4>
              <p className="mt-2 text-sm text-slate-400">
                After implementing AI recommendations, consistent top-3 positions
                across all target keywords.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  { pos: 1, kw: "san diego stucco" },
                  { pos: 2, kw: "stucco repair" },
                  { pos: 1, kw: "exterior plaster" },
                ].map((r) => (
                  <div
                    key={r.kw}
                    className="flex items-center justify-between rounded-lg bg-emerald-500/5 px-4 py-2.5"
                  >
                    <span className="text-sm text-slate-400">{r.kw}</span>
                    <span className="font-bold text-emerald-400">#{r.pos}</span>
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
