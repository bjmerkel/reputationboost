"use client";

import { usePreviewAudit } from "@/context/PreviewAuditContext";
import ScoreImpactSlider from "@/components/marketing/ScoreImpactSlider";
import SectionHeader from "@/components/marketing/SectionHeader";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

const grades = [
  { label: "Healthy", range: "70–100", className: "border-[#ceead6] bg-[#e6f4ea] text-[#188038]" },
  { label: "At Risk", range: "40–69", className: "border-[#fdd663] bg-[#fef7e0] text-[#e37400]" },
  { label: "Urgent", range: "0–39", className: "border-[#f6aea9] bg-[#fce8e6] text-[#d93025]" },
];

const howItWorks = [
  {
    step: "01",
    title: "Audit & Score",
    description:
      "Connect your Google Business Profile, we pick your keywords, you get your Reputation Boost Score.",
  },
  {
    step: "02",
    title: "Get Your Plan",
    description:
      "A clear list of what to fix first — with estimated score and revenue impact for each step.",
  },
  {
    step: "03",
    title: "Execute & Prove",
    description:
      "You approve changes, we publish them — including geo-targeted review requests and beat-the-leader tests on weak map cells. Track calls, rankings, AI mentions, and dollars every day.",
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ProofNarrative() {
  const { preview, isLive } = usePreviewAudit();

  if (!isLive || !preview) {
    return (
      <section id="how-it-works" className="scroll-mt-28 border-b border-[#dadce0] bg-[#f8f9fa] py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            label="How It Works"
            labelColor="cyan"
            title={
              <>
                From score to <span className="gradient-text font-semibold">revenue</span>
              </>
            }
            subtitle="Search your business above — we'll audit your Google listing and build your plan."
          />

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {howItWorks.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[#dadce0] bg-white p-6 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0fe] text-sm font-bold text-[#1a73e8]">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#202124]">{item.title}</h3>
                <p className="mt-2 text-sm text-[#5f6368]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const currentScore = preview.score.overall;
  const projectedScore = preview.pathToHealthy.projectedScore;
  const revenueGain = preview.pathToHealthy.estimatedRevenueGain ?? 0;
  const driverScore = preview.score.driverScore;
  const outcomeScore = preview.score.outcomeIndex;

  const profileGap = preview.topGap?.title ?? "Strengthen reviews, photos, and posts to win more clicks";

  const rankingKw = preview.keywords.find((k) => !k.inLocalPack);
  const rankingGap = rankingKw
    ? `Outside the Local 3-Pack on "${rankingKw.keyword}"`
    : "In pack for your tracked keywords";

  const attributionItems = preview.pathToHealthy.topActions.map((action) => ({
    action: action.title,
    outcome: `Projected +${action.scoreImpact} pts on your score`,
    revenue:
      revenueGain > 0
        ? `Part of ${formatCurrency(revenueGain)}/mo path to healthy`
        : "Revenue tracked after signup",
  }));

  const totalAttributed = preview.pathToHealthy.estimatedRevenueGain ?? 0;

  return (
    <>
      {/* ── Your Score ── */}
      <section
        id="your-score"
        className="scroll-mt-28 border-b border-[#dadce0] bg-white py-20 lg:py-28"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            label="Your Score"
            labelColor="emerald"
            title={
              <>
                One number that tells you if Google is{" "}
                <span className="gradient-text font-semibold">sending you customers</span>
              </>
            }
            subtitle={`${preview.business.name} scores ${currentScore}/100 — how strong your listing looks and where you rank, in one number. Pan the map above to see where you show up.`}
          />

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {grades.map((grade) => (
              <div
                key={grade.label}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${grade.className}`}
              >
                {grade.label} · {grade.range}
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold text-[#202124]">How Your Listing Looks</h3>
                <span className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-semibold text-[#1a73e8]">
                  70% of score
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6368]">
                How complete and trustworthy your Google listing looks to Google and customers.
              </p>
              <p className="mt-4 text-3xl font-semibold text-[#202124]">{driverScore}</p>
              <p className="mt-3 rounded-lg border border-[#fce8e6] bg-[#fef7f6] px-3 py-2 text-sm text-[#3c4043]">
                {profileGap}
              </p>
            </article>

            <article className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold text-[#202124]">Where You Rank</h3>
                <span className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-semibold text-[#1a73e8]">
                  30% of score
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6368]">
                Where you actually rank for your keywords across your service area.
              </p>
              <p className="mt-4 text-3xl font-semibold text-[#202124]">{outcomeScore}</p>
              <p className="mt-3 rounded-lg border border-[#fce8e6] bg-[#fef7f6] px-3 py-2 text-sm text-[#3c4043]">
                {rankingGap}
              </p>
            </article>
          </div>

          <div className="mt-10 rounded-2xl border border-[#dadce0] bg-[#202124] p-8 lg:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  See what happens when you complete your plan
                </h3>
                <p className="mt-3 text-sm text-slate-400">
                  Drag the slider to simulate plan completion — watch your score climb and
                  projected revenue grow.
                </p>
              </div>
              <ScoreImpactSlider
                startScore={currentScore}
                endScore={projectedScore}
                maxRevenueGain={revenueGain}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Your Money ── */}
      <section
        id="your-money"
        className="scroll-mt-28 border-b border-[#dadce0] bg-white py-20 lg:py-28"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            label="Your Money"
            labelColor="emerald"
            title={
              <>
                We don&apos;t just promise rankings.{" "}
                <span className="gradient-text font-semibold">We prove revenue.</span>
              </>
            }
            subtitle="Every action ties to rank movement, calls, directions, and estimated revenue — so you know what actually paid off."
          />

          <div className="mt-10 space-y-3">
            {attributionItems.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-[#dadce0] bg-[#f8f9fa] p-5"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e6f4ea] text-sm font-bold text-[#188038]">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-[#202124]">{item.action}</p>
                    <p className="text-xs text-[#1a73e8]">→ {item.outcome}</p>
                    <p className="text-xs font-semibold text-[#188038]">→ {item.revenue}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-[#ceead6] bg-[#e6f4ea] px-6 py-8 text-center">
            <p className="text-2xl font-semibold text-[#202124] sm:text-3xl">
              Path to healthy: +{formatCurrency(totalAttributed)}
              <span className="text-lg font-normal text-[#5f6368]">/mo estimated</span>
            </p>
            <p className="mt-2 text-sm text-[#5f6368]">
              Based on tracked calls, directions, and profile views × your average job value
            </p>
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

      <section id="how-it-works" className="scroll-mt-28 bg-[#f8f9fa] py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            label="How It Works"
            labelColor="cyan"
            title={
              <>
                From score to <span className="gradient-text font-semibold">revenue</span>
              </>
            }
            subtitle="Three steps — your audit above is step one."
          />

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {howItWorks.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-[#dadce0] bg-white p-6 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0fe] text-sm font-bold text-[#1a73e8]">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#202124]">{item.title}</h3>
                <p className="mt-2 text-sm text-[#5f6368]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
