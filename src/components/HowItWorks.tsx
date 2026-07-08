import SectionHeader from "@/components/marketing/SectionHeader";

const steps = [
  {
    step: "01",
    title: "Audit & Score",
    description:
      "Connect your Google Business Profile. We AI-pick your best keywords, analyze rankings, competitors, and profile gaps — then calculate your Reputation Boost Score.",
  },
  {
    step: "02",
    title: "Get Your Plan",
    description:
      "AI builds a prioritized 15-step action plan with projected score and revenue impact for each step. Review AI-drafted copy before anything goes live.",
  },
  {
    step: "03",
    title: "Execute & Grow",
    description:
      "Approve changes, we publish to Google. Track daily score movement, rank improvements, and attributed revenue — then the loop runs again with sharper priorities.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-28 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          label="How It Works"
          labelColor="cyan"
          title={
            <>
              From score to <span className="gradient-text">revenue</span>
            </>
          }
          subtitle="Three steps to know your score, fix what's holding you back, and prove the results with real attribution data."
        />

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
              <h4 className="text-lg font-bold text-white">Score 47 — At Risk</h4>
              <p className="mt-2 text-sm text-slate-400">
                Outside the Local 3-Pack on most keywords. Missing calls and
                direction requests that go to competitors above you.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-orange-500 text-sm font-bold text-orange-400">
                  47
                </div>
                <p className="text-sm text-slate-400">Reputation Boost Score</p>
              </div>
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
              <h4 className="text-lg font-bold text-white">Score 72 — Healthy</h4>
              <p className="mt-2 text-sm text-slate-400">
                In the Local 3-Pack on key keywords. +$4,200/mo estimated revenue
                from more calls, directions, and profile views.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-emerald-500 text-sm font-bold text-emerald-400">
                  72
                </div>
                <p className="text-sm text-emerald-400">+25 pts · +$4,200/mo</p>
              </div>
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
