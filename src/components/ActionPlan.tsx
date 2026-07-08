import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import SectionHeader from "@/components/marketing/SectionHeader";

const phases = [
  {
    id: "foundation",
    title: "Foundation",
    description: "Categories, description, services, hours, attributes",
    steps: [
      { title: "Primary Category", impact: 8 },
      { title: "Rewrite Business Description", impact: 6 },
      { title: "Complete Service Section", impact: 5 },
    ],
  },
  {
    id: "content",
    title: "Content Engine",
    description: "Photos, videos, and posts",
    steps: [
      { title: "Photo Optimization", impact: 7 },
      { title: "Weekly Google Posts", impact: 5 },
    ],
  },
  {
    id: "reputation",
    title: "Reputation",
    description: "Reviews strategy and response management",
    steps: [
      { title: "Request more reviews", impact: 6 },
      { title: "Review Responses", impact: 4 },
    ],
  },
  {
    id: "ongoing",
    title: "Ongoing",
    description: "Continuous activity to maintain momentum",
    steps: [
      { title: "Continuous Activity", impact: 3 },
    ],
  },
];

export default function ActionPlan() {
  return (
    <section id="action-plan" className="relative scroll-mt-28 py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.03] to-transparent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionHeader
          label="Your Action Plan"
          labelColor="violet"
          title={
            <>
              A personalized plan —{" "}
              <span className="gradient-text">not a PDF that collects dust</span>
            </>
          }
          subtitle="16 prioritized GBP optimizations across four phases. Each step shows projected Reputation Boost Score impact so you know what moves the needle."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          {phases.map((phase) => (
            <article
              key={phase.id}
              className="gradient-border overflow-hidden rounded-2xl"
            >
              <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{phase.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{phase.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
                    {phase.steps.length} steps
                  </span>
                </div>

                <ol className="mt-5 space-y-2">
                  {phase.steps.map((step) => (
                    <li
                      key={step.title}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 text-[10px] text-emerald-400">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm text-slate-300">{step.title}</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400">
                        +{step.impact} pts
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 gradient-border overflow-hidden rounded-2xl">
          <div className="grid gap-6 rounded-[calc(1rem-1px)] bg-slate-900/60 p-8 lg:grid-cols-2 lg:p-10">
            <div>
              <h3 className="text-xl font-bold text-white">Review before we publish</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Every Google Post, description rewrite, and review response is
                drafted by AI and queued for your approval. Batch-approve routine
                items or review each one — you stay in control.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-400">
                  Pending approval
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Google Post: &ldquo;Spring drain cleaning special in Austin…&rdquo;
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">
                    Approve
                  </span>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
                    Edit
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 opacity-60">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Completed
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Business description updated · +6 pts
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <a
            href={SIGNUP_URL}
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white"
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
