import SectionHeader from "@/components/marketing/SectionHeader";

const loopSteps = [
  {
    title: "Measure nightly",
    description:
      "We ingest your latest GBP data and geo-grid rankings every night and recalculate your Reputation Boost Score.",
  },
  {
    title: "Attribute in 14-day windows",
    description:
      "When you complete plan actions, we measure rank movement, calls, directions, and estimated revenue in before/after windows.",
  },
  {
    title: "Learn & reprioritize",
    description:
      "Observed impact calibrates future projections and reshuffles your next actions — so the plan gets sharper, not stale.",
  },
];

export default function NightlyScoreLoop() {
  return (
    <section id="nightly-score" className="scroll-mt-28 border-b border-[#dadce0] bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="Why we're different"
          labelColor="cyan"
          title={
            <>
              The score gets smarter{" "}
              <span className="gradient-text font-semibold">every night</span>
            </>
          }
          subtitle="Most GBP tools audit once and send a PDF. Reputation Boost runs a recursive loop — measure, act, attribute, learn — so your score and plan improve daily."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {loopSteps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0fe] text-sm font-bold text-[#1a73e8]">
                {index + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#202124]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5f6368]">{step.description}</p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-[#80868b]">
          This closed loop is what separates us from one-time audits — and it&apos;s why projections
          get more accurate the longer you use the platform.
        </p>
      </div>
    </section>
  );
}
