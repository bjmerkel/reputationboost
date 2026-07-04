"use client";

import Link from "next/link";
import { usePreviewAudit } from "@/context/PreviewAuditContext";
import ScoreImpactSlider from "@/components/marketing/ScoreImpactSlider";
import SectionHeader from "@/components/marketing/SectionHeader";
import { SIGNUP_URL, SIGNUP_CTA_LABEL } from "@/lib/constants";

const grades = [
  { label: "Healthy", range: "70–100", className: "border-[#ceead6] bg-[#e6f4ea] text-[#188038]" },
  { label: "At Risk", range: "40–69", className: "border-[#fdd663] bg-[#fef7e0] text-[#e37400]" },
  { label: "Urgent", range: "0–39", className: "border-[#f6aea9] bg-[#fce8e6] text-[#d93025]" },
];

const localPackStats = [
  { value: "70–75%", label: "of map clicks go to the top 3" },
  { value: "44%", label: "of total SERP clicks" },
  { value: "3×", label: "more engagement in the pack" },
];

const howItWorks = [
  {
    step: "01",
    title: "Audit & Score",
    description: "Connect GBP, AI-pick keywords, get your Reputation Boost Score.",
  },
  {
    step: "02",
    title: "Get Your Plan",
    description: "16 prioritized actions with projected score and revenue impact.",
  },
  {
    step: "03",
    title: "Execute & Prove",
    description: "Approve changes, we publish. Track attributed revenue daily.",
  },
];

const demoAttribution = [
  {
    action: "Updated business description for target keyword",
    outcome: "Keyword moved #8 → #3",
    revenue: "+$1,850 estimated revenue",
  },
  {
    action: "Published 12 new service photos",
    outcome: "Profile strength +6 pts · +340 profile views",
    revenue: "+$920 estimated revenue",
  },
  {
    action: "Responded to 8 pending reviews",
    outcome: "Response rate 100% · +3 calls, +7 directions",
    revenue: "+$640 estimated revenue",
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRank(
  inLocalPack: boolean,
  position: number | "not_in_pack",
  rank: number | null
): string {
  if (inLocalPack && typeof position === "number") return `#${position} in pack`;
  if (rank != null) return `#${rank} — not in pack`;
  return "Not in pack";
}

export default function ProofNarrative() {
  const { preview, isLive, platformAudit } = usePreviewAudit();

  const currentScore = preview?.score.overall ?? 47;
  const projectedScore = preview?.pathToHealthy.projectedScore ?? 72;
  const revenueGain =
    preview?.pathToHealthy.estimatedRevenueGain ?? 4200;
  const driverScore = preview?.score.driverScore ?? platformAudit.strategy?.scores.driverScore ?? 52;
  const outcomeScore = preview?.score.outcomeIndex ?? platformAudit.strategy?.scores.outcomeIndex ?? 38;

  const profileGap =
    preview?.topGap?.title.includes("photo") || preview?.topGap?.title.includes("Photo")
      ? preview.topGap.title
      : platformAudit.gbp.content.photoCount < 20
        ? `Only ${platformAudit.gbp.content.photoCount} photos — top competitors average 60+`
        : "Strengthen reviews, photos, and posts to win more clicks";

  const rankingGap =
    preview?.keywords.find((k) => !k.inLocalPack)?.keyword != null
      ? `Outside the Local 3-Pack on "${preview.keywords.find((k) => !k.inLocalPack)?.keyword}"`
      : "In pack for only part of your service area";

  const keywords = preview?.keywords ?? platformAudit.rankings.keywords.map((kw) => ({
    keyword: kw.keyword,
    rank: typeof kw.localPackPosition === "number" ? kw.localPackPosition : kw.geoRanks[0]?.rank ?? null,
    inLocalPack: kw.inLocalPack,
    localPackPosition: kw.localPackPosition,
    packLeaderReviewCount: kw.packLeaderReviewCount,
    clientReviewCount: kw.clientReviewCount,
  }));

  const attributionItems =
    preview?.pathToHealthy.topActions.length
      ? preview.pathToHealthy.topActions.map((action) => ({
          action: action.title,
          outcome: `Projected +${action.scoreImpact} pts on your score`,
          revenue:
            revenueGain > 0
              ? `Part of ${formatCurrency(revenueGain)}/mo path to healthy`
              : "Revenue tracked after signup",
        }))
      : demoAttribution;

  const totalAttributed = preview?.pathToHealthy.estimatedRevenueGain ?? 3410;

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
            subtitle={
              isLive
                ? `${preview!.business.name} scores ${currentScore}/100 — profile strength and ranking outcome in one number.`
                : "Search your business above for your live score, or explore how profile strength and rankings blend into one metric."
            }
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
                <h3 className="text-lg font-semibold text-[#202124]">Profile Strength</h3>
                <span className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-semibold text-[#1a73e8]">
                  70% of score
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6368]">
                How complete and trustworthy your GBP looks to Google and customers.
              </p>
              <p className="mt-4 text-3xl font-semibold text-[#202124]">{driverScore}</p>
              <p className="mt-3 rounded-lg border border-[#fce8e6] bg-[#fef7f6] px-3 py-2 text-sm text-[#3c4043]">
                {profileGap}
              </p>
            </article>

            <article className="rounded-2xl border border-[#dadce0] bg-[#f8f9fa] p-6">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold text-[#202124]">Ranking Outcome</h3>
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

      {/* ── Your Map ── */}
      <section
        id="your-map"
        className="scroll-mt-28 border-b border-[#dadce0] bg-[#f8f9fa] py-20 lg:py-28"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeader
            label="Your Map"
            labelColor="cyan"
            title={
              <>
                Where you rank — and where{" "}
                <span className="gradient-text font-semibold">competitors win</span>
              </>
            }
            subtitle="70–75% of map clicks go to the top 3. Every keyword outside the Local 3-Pack sends customers to someone else."
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {localPackStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-[#dadce0] bg-white px-4 py-5 text-center"
              >
                <p className="text-2xl font-semibold text-[#1a73e8]">{stat.value}</p>
                <p className="mt-1 text-sm text-[#5f6368]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 space-y-3">
            {keywords.slice(0, 3).map((kw) => (
              <div
                key={kw.keyword}
                className="flex flex-col gap-2 rounded-xl border border-[#dadce0] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[#202124]">{kw.keyword}</p>
                  {!kw.inLocalPack && kw.packLeaderReviewCount > 0 && (
                    <p className="mt-0.5 text-xs text-[#80868b]">
                      Pack leader has {kw.packLeaderReviewCount} reviews
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 self-start rounded-full px-3 py-1 text-xs font-semibold sm:self-center"
                  style={{
                    backgroundColor: kw.inLocalPack ? "#e6f4ea" : "#fce8e6",
                    color: kw.inLocalPack ? "#188038" : "#d93025",
                  }}
                >
                  {formatRank(kw.inLocalPack, kw.localPackPosition, kw.rank)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <a
              href="#platform-explorer"
              className="btn-secondary inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium"
            >
              Explore the interactive map ↑
            </a>
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
              {isLive ? (
                <>
                  Path to healthy: +{formatCurrency(totalAttributed)}
                  <span className="text-lg font-normal text-[#5f6368]">/mo estimated</span>
                </>
              ) : (
                <>
                  Reputation Boost drove an estimated{" "}
                  <span className="text-[#188038]">{formatCurrency(totalAttributed)}</span> this
                  month
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-[#5f6368]">
              Based on attributed calls, directions, and profile views × your avg job value
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

      {/* ── How it works (compact) ── */}
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
            subtitle="Three steps — search above to start with your business."
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

          <p className="mt-8 text-center text-sm text-[#80868b]">
            Your score improves daily through a measure → act → attribute → learn loop.{" "}
            <Link href="#platform-explorer" className="text-[#1a73e8] hover:underline">
              See it in the platform explorer
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
