import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import SectionHeader from "@/components/marketing/SectionHeader";

const loopSteps = [
  {
    step: "1",
    title: "Measure daily",
    description:
      "Every night we ingest your keyword rankings, GBP performance, and profile signals — so your score reflects reality, not a stale snapshot.",
  },
  {
    step: "2",
    title: "Score recalculates",
    description:
      "Your Reputation Boost Score updates with a changelog: what moved, which keywords shifted, and whether profile strength or ranking outcome drove the change.",
  },
  {
    step: "3",
    title: "Execute your plan",
    description:
      "Approve AI-drafted actions. We publish to Google. Each step carries a projected +N pt impact on your score.",
  },
  {
    step: "4",
    title: "Attribute results",
    description:
      "14-day before/after windows tie each action to rank movement, calls, directions, and estimated revenue — so you know what actually worked.",
  },
  {
    step: "5",
    title: "Learn & calibrate",
    description:
      "Observed score movement feeds back into our model. Future projections get sharper — for your business and across the platform.",
  },
  {
    step: "6",
    title: "Reprioritize & repeat",
    description:
      "New gaps surface. Your path to 70 updates. The next highest-impact actions rise to the top. The loop runs again tomorrow.",
  },
];

const scoreTimeline = [
  { date: "Week 1", score: 47, entry: "Baseline audit · score 47" },
  { date: "Week 2", score: 52, entry: "+5 pts · 12 photos added" },
  { date: "Week 4", score: 58, entry: "+6 pts · description optimized" },
  { date: "Week 6", score: 65, entry: "+7 pts · \"plumber\" moved #8 → #3" },
  { date: "Week 8", score: 72, entry: "+7 pts · entered Local 3-Pack on 2 keywords" },
];

function scoreColor(score: number): string {
  if (score >= 70) return "#188038";
  if (score >= 40) return "#e37400";
  return "#d93025";
}

export default function ScoreFlywheel() {
  return (
    <section id="score-flywheel" className="scroll-mt-28 border-y border-[#dadce0] bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="Continuous Improvement"
          labelColor="cyan"
          title={
            <>
              Your score improves{" "}
              <span className="gradient-text font-semibold">recursively</span>
            </>
          }
          subtitle="This isn't a one-time audit. Reputation Boost runs a closed loop — measure, act, attribute, learn, and improve — every single day."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-4">
            {loopSteps.map((item, index) => (
              <div key={item.step} className="relative flex gap-4">
                {index < loopSteps.length - 1 && (
                  <div className="absolute left-[15px] top-10 h-[calc(100%+4px)] w-px bg-[#dadce0]" />
                )}
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-bold text-white">
                  {item.step}
                </div>
                <div className="min-w-0 pb-2">
                  <h3 className="font-medium text-[#202124]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#5f6368]">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#ceead6] bg-[#e6f4ea] px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-[#188038]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-sm text-[#137333]">
                <span className="font-medium">The loop never stops.</span>{" "}
                Rankings shift, competitors move, and your plan adapts — your score keeps climbing.
              </p>
            </div>
          </div>

          <div className="maps-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
              Score over time
            </p>
            <p className="mt-1 text-sm text-[#5f6368]">
              Recursive improvement in action — same business, 8 weeks
            </p>

            <div className="mt-6 flex items-end justify-between gap-2">
              {scoreTimeline.map((point) => (
                <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: scoreColor(point.score) }}
                  >
                    {point.score}
                  </span>
                  <div
                    className="w-full max-w-[40px] rounded-t bg-[#1a73e8]/70"
                    style={{ height: `${(point.score / 100) * 80}px` }}
                  />
                  <span className="text-[10px] text-[#80868b]">{point.date}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 border-t border-[#e8eaed] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
                What changed
              </p>
              {scoreTimeline.slice(1).map((point) => (
                <div
                  key={point.date}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-[#5f6368]">{point.entry}</span>
                  <span className="shrink-0 font-semibold text-[#188038]">
                    {point.score}/100
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <a
            href={SIGNUP_URL}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-medium text-white"
          >
            {SIGNUP_CTA_LABEL}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
