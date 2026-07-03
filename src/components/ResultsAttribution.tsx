import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import SectionHeader from "@/components/marketing/SectionHeader";

const attributionChain = [
  {
    action: "Updated business description for \"emergency plumber austin\"",
    rank: "Keyword moved #8 → #3",
    engagement: "+5 calls, +12 directions",
    revenue: "+$1,850 estimated revenue",
  },
  {
    action: "Published 12 new service photos",
    rank: "Profile strength +6 pts",
    engagement: "+340 profile views",
    revenue: "+$920 estimated revenue",
  },
  {
    action: "Responded to 8 pending reviews",
    rank: "Response rate 100%",
    engagement: "+3 calls, +7 directions",
    revenue: "+$640 estimated revenue",
  },
];

const metrics = [
  { label: "Calls", value: "47", delta: "+12", up: true },
  { label: "Directions", value: "89", delta: "+23", up: true },
  { label: "Website Clicks", value: "156", delta: "+31", up: true },
  { label: "Profile Views", value: "2,081", delta: "+340", up: true },
];

export default function ResultsAttribution() {
  return (
    <section id="results" className="relative scroll-mt-28 py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeader
          label="Results & Attribution"
          labelColor="emerald"
          title={
            <>
              We don&apos;t just promise rankings.{" "}
              <span className="gradient-text">We prove revenue.</span>
            </>
          }
          subtitle="Every completed action is tracked against keyword movement, engagement metrics, and estimated revenue — so you see exactly what paid off."
        />

        <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="gradient-border rounded-xl p-4 text-center"
            >
              <div className="rounded-[calc(0.75rem-1px)] bg-slate-900/60 px-3 py-5">
                <p className="text-2xl font-bold text-white">{m.value}</p>
                <p className="mt-1 text-xs text-slate-500">{m.label}</p>
                <p className={`mt-1 text-xs font-semibold ${m.up ? "text-emerald-400" : "text-red-400"}`}>
                  {m.delta} this month
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-4">
          {attributionChain.map((item, i) => (
            <div
              key={i}
              className="gradient-border overflow-hidden rounded-xl"
            >
              <div className="rounded-[calc(0.75rem-1px)] bg-slate-900/60 p-5">
                <div className="flex flex-wrap items-start gap-4 lg:gap-8">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-medium text-white">{item.action}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                      <span className="text-cyan-400">→ {item.rank}</span>
                      <span className="text-violet-400">→ {item.engagement}</span>
                      <span className="font-semibold text-emerald-400">→ {item.revenue}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 gradient-border overflow-hidden rounded-2xl">
          <div className="rounded-[calc(1rem-1px)] bg-gradient-to-r from-emerald-950/40 to-slate-900/60 px-8 py-8 text-center">
            <p className="text-3xl font-extrabold text-white">
              Reputation Boost drove an estimated{" "}
              <span className="text-emerald-400">$3,410</span> this month
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Based on attributed calls, directions, and website clicks × your avg job value
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <a
            href={SIGNUP_URL}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white"
          >
            See what you&apos;re leaving on the table
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
