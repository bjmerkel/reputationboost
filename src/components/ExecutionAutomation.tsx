const capabilities = [
  {
    title: "Google Posts",
    description: "AI-written, localized posts published on schedule to keep your profile active.",
    tag: "Weekly cadence",
  },
  {
    title: "AI Review Responder",
    description: "Automated and canned responses for every review — batch-approve or customize each one.",
    tag: "Auto + manual",
  },
  {
    title: "GBP Profile Optimization",
    description: "Categories, services, descriptions, photos, videos, and Q&A applied directly via Google API.",
    tag: "16-step plan",
  },
  {
    title: "SMS Review Requests",
    description: "Send happy customers a text to leave a review — more reviews, stronger profile strength.",
    tag: "Review growth",
  },
  {
    title: "Social Media Posts",
    description: "Facebook and Instagram content on Omni (1×/week) and Spectrum (3×/week) plans.",
    tag: "Omni & Spectrum",
  },
  {
    title: "Review Disputes",
    description: "Flag and dispute illegitimate negative reviews that hurt your ranking and reputation.",
    tag: "Spectrum plan",
  },
];

export default function ExecutionAutomation() {
  return (
    <section id="execution" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            Execution & Automation
          </span>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            We do the work.{" "}
            <span className="gradient-text">You approve. Google gets updated.</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Unlike DIY tools that hand you a checklist, Reputation Boost executes
            approved changes on your behalf — with a dedicated account manager
            overseeing every plan.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap) => (
            <article
              key={cap.title}
              className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 transition-colors hover:border-emerald-500/20"
            >
              <span className="inline-block rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                {cap.tag}
              </span>
              <h3 className="mt-3 text-lg font-bold text-white">{cap.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {cap.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-5 text-center">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-emerald-400">Every change is logged.</span>{" "}
            Every result is attributed back to the action that caused it.
          </p>
        </div>
      </div>
    </section>
  );
}
