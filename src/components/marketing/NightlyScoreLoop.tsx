import SectionHeader from "@/components/marketing/SectionHeader";

const loopSteps = [
  {
    title: "We check every night",
    description:
      "While you sleep, we pull your latest Google Business Profile data, check where you rank across your service area, and update your Reputation Boost Score.",
  },
  {
    title: "We show you what worked",
    description:
      "When you fix something, we measure results in 14-day before/after windows — higher rank, more calls, more direction requests, real dollars.",
  },
  {
    title: "Your plan gets smarter",
    description:
      "The more you use it, the better we know what works for your business — and we put those actions at the top of your list.",
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
          subtitle="Most tools audit your Google listing once and email a PDF. We check and improve your score every single night — it works while you sleep."
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
          That&apos;s why your estimates get more accurate the longer you stick with it — not a
          one-time report you forget about.
        </p>
      </div>
    </section>
  );
}
