import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";
import SectionHeader from "@/components/marketing/SectionHeader";
import ScoreImpactSlider from "@/components/marketing/ScoreImpactSlider";

const pillars = [
  {
    title: "Profile Strength",
    weight: "70%",
    description:
      "How complete and trustworthy your GBP looks to Google and customers.",
    signals: [
      "Review count, rating & response rate",
      "Photos, videos & post recency",
      "Business description & categories",
      "Q&A completeness",
      "Keyword relevance in profile",
    ],
    example: "Only 12 photos vs. competitor avg of 47",
  },
  {
    title: "Ranking Outcome",
    weight: "30%",
    description:
      "Where you actually rank for your keywords across your service area.",
    signals: [
      "Visibility — geo-grid pack coverage",
      "Revenue capture — click-share by position",
      "Per-keyword Local 3-Pack status",
      "Competitor benchmark gaps",
      "Daily rank movement tracking",
    ],
    example: "In pack for only 23% of your service area",
  },
];

const grades = [
  { label: "Healthy", range: "70–100", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { label: "At Risk", range: "40–69", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  { label: "Urgent", range: "0–39", color: "text-red-400 bg-red-500/10 border-red-500/20" },
];

export default function ReputationScore() {
  return (
    <section id="reputation-score" className="relative scroll-mt-28 py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          label="Reputation Boost Score"
          labelColor="emerald"
          title={
            <>
              One number that tells you if Google is{" "}
              <span className="gradient-text">sending you customers</span>
            </>
          }
          subtitle="Most businesses guess. You'll know — and your score keeps improving every day through a recursive measure-act-learn loop."
        />

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          {grades.map((grade) => (
            <div
              key={grade.label}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${grade.color}`}
            >
              {grade.label} · {grade.range}
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="gradient-border overflow-hidden rounded-2xl"
            >
              <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-xl font-bold text-white">{pillar.title}</h3>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-sm font-semibold text-emerald-400">
                    {pillar.weight} of score
                  </span>
                </div>
                <p className="mt-3 text-slate-400">{pillar.description}</p>

                <ul className="mt-6 space-y-2">
                  {pillar.signals.map((signal) => (
                    <li key={signal} className="flex items-start gap-2 text-sm text-slate-300">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {signal}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Example gap surfaced
                  </p>
                  <p className="mt-1 text-sm text-slate-300">&ldquo;{pillar.example}&rdquo;</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 gradient-border overflow-hidden rounded-2xl">
          <div className="rounded-[calc(1rem-1px)] bg-slate-900/60 p-8 lg:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-2xl font-bold text-white">
                  See what happens when you complete your plan
                </h3>
                <p className="mt-3 text-slate-400">
                  Drag the slider to simulate plan completion — watch your score
                  climb and projected revenue grow in real time.
                </p>
              </div>
              <ScoreImpactSlider />
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
