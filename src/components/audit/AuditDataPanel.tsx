"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CompetitorProfile,
  CompetitorSnapshot,
  ExecutionTask,
  FullAuditPayload,
  GbpLocalPostCoverage,
  GbpMediaCoverage,
  GbpMediaPreview,
  GbpPerformanceCoverage,
  GbpPlaceActionCoverage,
  GbpPlaceActionLinkSummary,
  GbpPostItem,
  GbpReviewCoverage,
  KeywordRankSnapshot,
  ReviewRecord,
} from "@/audit/types";
import ExternalImage from "@/components/ExternalImage";
import GoogleMapsLink from "@/components/GoogleMapsLink";
import TrendsPanel from "@/components/attribution/TrendsPanel";
import ProfileCommandCenter from "@/components/audit/ProfileCommandCenter";
import {
  buildAttributionCalibration,
  mergeCalibrations,
  type AttributionCalibration,
} from "@/audit/phase2/attribution-calibration";
import { parseMediaViewCount } from "@/lib/google/gbp-media";
import { buildFieldAttributionCalibration } from "@/audit/phase2/field-attribution-calibration";
import type { ActionAttribution } from "@/audit/types/timeseries";
import type { EngagementPeriodSummary } from "@/audit/engagement-period";
import { formatPerformanceIngestLabel, formatPerformanceIngestTimestamp } from "@/audit/engagement-period";
import { formatCustomerAttribution } from "@/lib/google/gbp-media-display";
import { buildMediaHealthReport } from "@/lib/google/gbp-media-health";
import { buildPerformanceHealthReport } from "@/lib/google/gbp-performance-health";
import { buildReviewsHealthReport } from "@/lib/google/gbp-reviews-health";
import { buildLocalPostsHealthReport } from "@/lib/google/gbp-local-posts-health";
import { buildPlaceActionsHealthReport } from "@/lib/google/gbp-place-actions-health";
import { competitorMapRank } from "@/lib/google/local-rankings";
import { formatStarRating } from "@/lib/format-star-rating";
import { computeKeywordPortfolio, listUntrackedGbpSearchTerms } from "@/audit/phase2/keyword-portfolio";
import KeywordPortfolioPanel from "@/components/audit/KeywordPortfolioPanel";
import RankingsCoverageTable from "@/components/audit/RankingsCoverageTable";

type KeywordsUpdatedHandler = (keywords: string[]) => void;

type DataTab =
  | "profile"
  | "performance"
  | "rankings"
  | "competitors"
  | "reviews"
  | "trends";

const DATA_TABS: { id: DataTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "performance", label: "Performance" },
  { id: "rankings", label: "Rankings" },
  { id: "trends", label: "Trends" },
  { id: "competitors", label: "Competitors" },
  { id: "reviews", label: "Reviews" },
];

function resolveLocalPackCompetitors(snap: CompetitorSnapshot): CompetitorProfile[] {
  return snap.localPack ?? snap.competitors ?? [];
}

function resolveWiderRadiusTiers(snap: CompetitorSnapshot) {
  return snap.widerRadius ?? [];
}

function resolveTextSearchFallback(snap: CompetitorSnapshot): CompetitorProfile[] {
  return snap.textSearchFallback ?? [];
}

function competitorBusinessStatus(
  snap: CompetitorSnapshot,
  keywordRank: KeywordRankSnapshot | undefined
): string | null {
  if (!keywordRank) return null;

  const rank1 = keywordRank.geoRanks.find((point) => point.distanceMiles === 1)?.rank ?? null;

  if (keywordRank.inLocalPack && typeof keywordRank.localPackPosition === "number") {
    return `Your business: estimated #${keywordRank.localPackPosition} at the business pin`;
  }
  if (rank1 != null && rank1 > 3) {
    return `Your business: outside 3-Pack at 1 mi (#${rank1})`;
  }

  const nearbyHasResults =
    snap.nearbyHasResults ??
    (resolveLocalPackCompetitors(snap).length > 0 || rank1 != null);
  if (!nearbyHasResults) {
    return "No Nearby Search results at 1 mi for this phrase";
  }

  return "Your business: not found in 1 mi Nearby Search results";
}

function hasAnyCompetitors(snap: CompetitorSnapshot): boolean {
  return (
    resolveLocalPackCompetitors(snap).length > 0 ||
    resolveWiderRadiusTiers(snap).some((tier) => tier.competitors.length > 0) ||
    resolveTextSearchFallback(snap).length > 0
  );
}

function CompetitorRows({
  keyword,
  competitors,
  theme,
}: {
  keyword: string;
  competitors: CompetitorProfile[];
  theme: ReturnType<typeof auditDataTheme>;
}) {
  return competitors.map((competitor, index) => (
    <div key={competitor.placeId} className={theme.competitorRow}>
      <span className={theme.competitorName}>
        #{competitorMapRank(competitor.mapPositions, keyword, index)} {competitor.name}
      </span>
      <span className={`text-sm ${theme.muted}`}>
        {formatStarRating(competitor.averageRating)}★ · {competitor.reviewCount} reviews
      </span>
    </div>
  ));
}

function auditDataTheme(light: boolean) {
  return {
    card: light
      ? "rounded-xl border border-[#dadce0] bg-white p-4"
      : "rounded-xl border border-white/8 bg-white/[0.02] p-4",
    cardWide: light
      ? "col-span-full rounded-xl border border-[#dadce0] bg-white p-4"
      : "col-span-full rounded-xl border border-white/8 bg-white/[0.02] p-4",
    heading: light ? "text-sm font-semibold text-[#202124]" : "text-sm font-semibold text-slate-300",
    subheading: light ? "mt-1 text-xs text-[#5f6368]" : "mt-1 text-xs text-slate-500",
    scorePill: light
      ? "rounded-full bg-[#e8f0fe] px-3 py-1 text-sm font-semibold text-[#1a73e8]"
      : "rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white",
    metricBox: light ? "rounded-lg bg-[#f8f9fa] px-3 py-2" : "rounded-lg bg-white/5 px-3 py-2",
    metricLabel: light
      ? "text-[10px] uppercase tracking-wide text-[#80868b]"
      : "text-[10px] uppercase tracking-wide text-slate-500",
    metricValue: light ? "text-sm font-semibold text-[#202124]" : "text-sm font-semibold text-slate-200",
    metricValueLg: light ? "text-lg font-semibold text-[#202124]" : "text-lg font-semibold text-slate-200",
    muted: light ? "text-[#5f6368]" : "text-slate-400",
    body: light ? "text-[#3c4043]" : "text-slate-300",
    label: light ? "text-[#5f6368]" : "text-slate-500",
    value: light ? "text-[#202124]" : "text-slate-200",
    blockTitle: light ? "mb-3 text-sm font-semibold text-[#202124]" : "mb-3 text-sm font-semibold text-slate-300",
    okStatus: light ? "bg-[#e6f4ea] text-[#137333]" : "bg-emerald-500/10 text-emerald-300",
    warnStatus: light ? "bg-[#fef7e0] text-[#b06000]" : "bg-amber-500/10 text-amber-300",
    recommend: light ? "text-xs text-[#b06000]" : "text-xs text-amber-300/90",
    listItem: light ? "rounded-lg bg-[#f8f9fa] px-3 py-2" : "rounded-lg bg-white/5 px-3 py-2",
    competitorRow: light
      ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e8eaed] bg-[#f8f9fa] px-4 py-3"
      : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3",
    competitorName: light ? "text-[#202124]" : "text-white",
    keywordHeading: light ? "font-semibold text-[#137333]" : "font-semibold text-emerald-400",
    sectionLabel: light
      ? "mb-2 text-xs uppercase tracking-wider text-[#80868b]"
      : "mb-2 text-xs uppercase tracking-wider text-slate-500",
    tagEmerald: light ? "bg-[#e6f4ea] text-[#137333]" : "bg-emerald-500/10 text-emerald-300",
    tagRed: light ? "bg-[#fce8e6] text-[#c5221f]" : "bg-red-500/10 text-red-300",
    avatarFallback: light
      ? "flex h-8 w-8 items-center justify-center rounded-full bg-[#e8eaed] text-xs text-[#5f6368]"
      : "flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs text-slate-400",
    pillMuted: light
      ? "rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[#5f6368]"
      : "rounded-full bg-white/5 px-2 py-0.5 text-slate-300",
    empty: light ? "text-sm text-[#80868b]" : "text-sm text-slate-500",
    issuesList: light
      ? "mt-4 list-inside list-disc text-sm text-[#b06000]"
      : "mt-4 list-inside list-disc text-sm text-amber-400/90",
  };
}

export default function AuditDataPanel({
  audit,
  clientId,
  tasks = [],
  activeKeyword,
  onKeywordChange,
  embedded = false,
  variant = "light",
  layout = "canvas",
  gbpConnected = false,
  onNavigateToPlan,
  onKeywordsUpdated,
  attributions = [],
  globalCalibration = {},
  engagement = null,
}: {
  audit: FullAuditPayload;
  clientId: string;
  tasks?: ExecutionTask[];
  activeKeyword: string;
  onKeywordChange: (keyword: string) => void;
  embedded?: boolean;
  variant?: "dark" | "light";
  layout?: "sidebar" | "canvas";
  gbpConnected?: boolean;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: "google-updates") => void;
  onKeywordsUpdated?: KeywordsUpdatedHandler;
  attributions?: ActionAttribution[];
  globalCalibration?: AttributionCalibration;
  engagement?: EngagementPeriodSummary | null;
}) {
  const isLight = variant === "light";
  const isCanvas = layout === "canvas";
  const keywordPortfolio = useMemo(
    () => audit.keywordPortfolio ?? computeKeywordPortfolio(audit),
    [audit]
  );
  const untrackedGbpSearchTerms = useMemo(
    () => listUntrackedGbpSearchTerms(audit),
    [audit]
  );
  const currentKeywords = useMemo(
    () => audit.rankings.keywords.map((keyword) => keyword.keyword),
    [audit.rankings.keywords]
  );
  const profileGridClass = isCanvas
    ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    : "grid grid-cols-1 gap-4";
  const performanceGridClass = isCanvas
    ? "grid gap-4 sm:grid-cols-2"
    : "grid grid-cols-1 gap-4";
  const fieldCalibration = useMemo(() => {
    const calibration = mergeCalibrations(
      buildAttributionCalibration(attributions),
      globalCalibration
    );
    return buildFieldAttributionCalibration(calibration);
  }, [attributions, globalCalibration]);
  const [tab, setTab] = useState<DataTab>("profile");
  const [liveMedia, setLiveMedia] = useState<GbpMediaPreview[] | null>(null);

  const storedMedia = audit.gbp.content.mediaPreviews ?? [];
  const mediaPreviews = liveMedia ?? storedMedia;

  useEffect(() => {
    if (!gbpConnected || storedMedia.length > 0 || audit.gbp.content.photoCount === 0) {
      return;
    }

    let cancelled = false;

    async function loadMedia() {
      try {
        const res = await fetch("/api/google/gbp/media");
        const data = (await res.json()) as {
          items?: Array<{
            name?: string;
            thumbnailUrl?: string;
            googleUrl?: string;
            mediaFormat?: string;
            category?: string | null;
            description?: string;
            viewCount?: string;
            insights?: { viewCount?: string };
            attribution?: { profileName?: string };
          }>;
        };
        if (!res.ok || cancelled) return;

        const previews: GbpMediaPreview[] = (data.items ?? [])
          .filter((item) => item.thumbnailUrl || item.googleUrl)
          .slice(0, 24)
          .map((item) => {
            const viewCount = parseMediaViewCount(
              item.insights?.viewCount ?? item.viewCount ?? null
            );
            return {
              thumbnailUrl: item.thumbnailUrl || item.googleUrl || "",
              googleUrl: item.googleUrl || item.thumbnailUrl || "",
              mediaFormat: item.mediaFormat === "VIDEO" ? "VIDEO" : "PHOTO",
              category: item.category ?? null,
              description: item.description || undefined,
              name: item.name,
              ...(viewCount === null ? {} : { viewCount }),
              isCustomerPhoto: Boolean(item.attribution?.profileName),
              attributionName: item.attribution?.profileName || undefined,
            };
          });

        if (!cancelled && previews.length > 0) {
          setLiveMedia(previews);
        }
      } catch {
        // Keep audit snapshot data only
      }
    }

    void loadMedia();
    return () => {
      cancelled = true;
    };
  }, [audit.auditId, gbpConnected, storedMedia.length, audit.gbp.content.photoCount]);

  const performanceFreshnessLabel =
    (engagement && formatPerformanceIngestLabel(engagement)) ||
    `Audit collected ${formatPerformanceIngestTimestamp(audit.completedAt)}`;

  return (
    <div className={`min-w-0 ${isCanvas ? "space-y-5" : "space-y-4"}`}>
      {!embedded && (
        <div>
          <h2 className={`text-xl font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Audit Data
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Raw signals collected from Google Maps, your GBP, and off-platform sources.
          </p>
        </div>
      )}

      <div
        className={`-mx-1 flex gap-2 overflow-x-auto border-b px-1 pb-3 ${
          isLight ? "border-[#dadce0]" : "border-white/8"
        }`}
      >
        {DATA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-4 ${
              tab === t.id
                ? isLight
                  ? "bg-[#e8f0fe] text-[#1a73e8]"
                  : "bg-white/10 text-white"
                : isLight
                  ? "text-[#5f6368] hover:text-[#202124]"
                  : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="space-y-4">
          {audit.gbp.locationInventory && (
            <ProfileCommandCenter
              audit={audit}
              clientId={clientId}
              tasks={tasks}
              variant={isLight ? "light" : "dark"}
              fieldCalibration={fieldCalibration}
              onNavigateToPlan={onNavigateToPlan}
            />
          )}
          <div className={profileGridClass}>
            <div className="space-y-3">
              <DataBlock
                light={isLight}
                title="Identity"
                rows={[
                  ["Name", audit.gbp.identity.name],
                  ["Category", audit.gbp.identity.primaryCategory],
                  ["Phone", audit.gbp.identity.phone],
                  ["Website", audit.gbp.identity.website],
                ]}
              />
              <GoogleMapsLink
                mapsUrl={audit.gbp.identity.mapsUrl}
                name={audit.gbp.identity.name}
                address={audit.gbp.identity.address}
              />
            </div>
            <DataBlock
              light={isLight}
              title="Content & issues"
              rows={[
                ["Photos", String(audit.gbp.content.photoCount)],
                ["Videos", String(audit.gbp.content.videoCount ?? 0)],
                ["Last post", formatDate(audit.gbp.content.lastPostDate)],
                ["Verified", audit.gbp.issues.isVerified ? "Yes" : "No"],
                ["Completeness", `${audit.gbp.completeness.completenessScore}%`],
              ]}
            />
            {audit.gbp.notifications && (
              <DataBlock
                light={isLight}
                title="Real-time alerts"
                rows={[
                  [
                    "Pub/Sub",
                    audit.gbp.notifications.configured ? "Configured" : "Not configured",
                  ],
                  ["Coverage", `${audit.gbp.notifications.coverageScore}%`],
                  [
                    "Review alerts",
                    audit.gbp.notifications.hasReviewAlerts ? "On" : "Off",
                  ],
                  [
                    "Google edit alerts",
                    audit.gbp.notifications.hasGoogleUpdateAlerts ? "On" : "Off",
                  ],
                  [
                    "Customer media alerts",
                    audit.gbp.notifications.hasCustomerMediaAlerts ? "On" : "Off",
                  ],
                  [
                    "Subscribed types",
                    audit.gbp.notifications.enabledTypes.length > 0
                      ? String(audit.gbp.notifications.enabledTypes.length)
                      : "0",
                  ],
                ]}
              />
            )}
            <DataBlock
              light={isLight}
              title="Engagement"
              rows={[
                [
                  "Reviews",
                  `${audit.gbp.engagement.reviewCount} (${formatStarRating(audit.gbp.engagement.averageRating)}★)`,
                ],
                ["New (30d)", String(audit.gbp.engagement.reviewsLast30Days)],
                ["Response rate", `${Math.round(audit.gbp.engagement.responseRate * 100)}%`],
              ]}
            />

            {audit.gbp.placeActions && (
              <PlaceActionsHealthPanel
                light={isLight}
                coverage={audit.gbp.placeActions}
                links={audit.gbp.placeActionLinks ?? []}
              />
            )}

            {audit.gbp.localPosts && (
              <LocalPostsHealthPanel
                light={isLight}
                coverage={audit.gbp.localPosts}
                recentPosts={audit.gbp.recentPosts ?? []}
              />
            )}

            {(audit.gbp.content.photoCount > 0 || mediaPreviews.length > 0) && (
              <>
                {audit.gbp.content.mediaCoverage && (
                  <MediaHealthPanel
                    light={isLight}
                    coverage={audit.gbp.content.mediaCoverage}
                    photosByType={audit.gbp.content.photosByType}
                    videoCount={audit.gbp.content.videoCount ?? 0}
                  />
                )}
                <MediaGallery
                  light={isLight}
                  photoCount={audit.gbp.content.photoCount}
                  videoCount={audit.gbp.content.videoCount ?? 0}
                  photosByType={audit.gbp.content.photosByType}
                  previews={mediaPreviews}
                  coverage={audit.gbp.content.mediaCoverage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {tab === "performance" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              Customer actions and search terms from Google Performance API for the last{" "}
              {audit.gbp.performance.periodDays} days.
            </p>
            <p className={`text-xs ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>
              {performanceFreshnessLabel}
            </p>
          </div>
          <div className={performanceGridClass}>
            <DataBlock
              light={isLight}
              title={`Performance (${audit.gbp.performance.periodDays}d)`}
              rows={[
                ["Profile views", String(audit.gbp.performance.profileViews)],
                ["Maps impressions", String(audit.gbp.performance.impressionsMaps)],
                ["Search impressions", String(audit.gbp.performance.impressionsSearch)],
                ["Call clicks", String(audit.gbp.performance.calls)],
                ["Direction requests", String(audit.gbp.performance.directionRequests)],
                ["Website clicks", String(audit.gbp.performance.websiteClicks)],
                ["Messages", String(audit.gbp.performance.conversations)],
                ["Bookings", String(audit.gbp.performance.bookings)],
                [
                  "Data source",
                  audit.gbp.performance.source === "api" ? "Google Performance API" : "Unavailable",
                ],
                ...(audit.gbp.performance.error
                  ? [["API note", audit.gbp.performance.error] as [string, string]]
                  : []),
              ]}
            />
            {(audit.gbp.performance.searchKeywords?.length ?? 0) > 0 ? (
              <DataBlock
                light={isLight}
                title="Search keywords (Google)"
                rows={audit.gbp.performance.searchKeywords!.map((kw) => [
                  kw.keyword,
                  kw.belowThreshold
                    ? "< threshold"
                    : `${kw.impressions ?? 0} impressions`,
                ])}
              />
            ) : (
              <DataBlock
                light={isLight}
                title="Search keywords (Google)"
                rows={[["Keywords", "No search terms returned for this period"]]}
              />
            )}
            {audit.gbp.performance.coverage && (
              <PerformanceHealthPanel light={isLight} coverage={audit.gbp.performance.coverage} />
            )}
          </div>
          <KeywordPortfolioPanel
            portfolio={keywordPortfolio}
            currentKeywords={currentKeywords}
            businessSlug={clientId}
            businessName={audit.clientName}
            industry={audit.gbp.identity.primaryCategory}
            city={audit.gbp.identity.address.split(",")[1]?.trim()}
            state={audit.gbp.identity.address.match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1]}
            address={audit.gbp.identity.address}
            website={audit.gbp.identity.website ?? undefined}
            untrackedGbpSearchTerms={untrackedGbpSearchTerms}
            light={isLight}
            onKeywordsUpdated={onKeywordsUpdated}
          />
        </div>
      )}

      {tab === "rankings" && (
        <RankingsCoverageTable keywords={audit.rankings.keywords} light={isLight} />
      )}

      {tab === "competitors" && (
        <div className="space-y-6">
          <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Competitors come from the same Nearby Search used for your 3-Pack rank at 1 mi. When
            that search returns nothing, we fall back to a broader Text Search so you still see who
            ranks for the keyword.
          </p>
          {audit.competitors.map((snap) => {
            const keywordRank = audit.rankings.keywords.find((k) => k.keyword === snap.keyword);
            const theme = auditDataTheme(isLight);
            const localPackCompetitors = resolveLocalPackCompetitors(snap);
            const widerRadiusTiers = resolveWiderRadiusTiers(snap);
            const textSearchCompetitors = resolveTextSearchFallback(snap);
            const businessStatus = competitorBusinessStatus(snap, keywordRank);

            return (
            <div key={snap.keyword}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className={theme.keywordHeading}>{snap.keyword}</h4>
                {businessStatus ? (
                  <span className={`text-sm ${theme.muted}`}>{businessStatus}</span>
                ) : null}
              </div>
              <div className="space-y-4">
                {localPackCompetitors.length > 0 ? (
                  <div className="space-y-2">
                    <p className={theme.sectionLabel}>Local 3-Pack area (1 mi Nearby Search)</p>
                    <CompetitorRows
                      keyword={snap.keyword}
                      competitors={localPackCompetitors}
                      theme={theme}
                    />
                  </div>
                ) : null}

                {widerRadiusTiers.map((tier) =>
                  tier.competitors.length > 0 ? (
                    <div key={`${snap.keyword}-${tier.radiusMiles}`} className="space-y-2">
                      <p className={theme.sectionLabel}>
                        Also ranking within {tier.radiusMiles} mi (Nearby Search)
                      </p>
                      <CompetitorRows
                        keyword={snap.keyword}
                        competitors={tier.competitors}
                        theme={theme}
                      />
                    </div>
                  ) : null
                )}

                {textSearchCompetitors.length > 0 ? (
                  <div className="space-y-2">
                    <p className={theme.sectionLabel}>Broader search fallback (Text Search)</p>
                    <p className={`text-xs ${theme.muted}`}>
                      Nearby Search returned no businesses for this exact phrase. These come from a
                      broader Google Text Search near your location.
                    </p>
                    <CompetitorRows
                      keyword={snap.keyword}
                      competitors={textSearchCompetitors}
                      theme={theme}
                    />
                  </div>
                ) : null}

                {!hasAnyCompetitors(snap) ? (
                  <p className={`text-sm ${theme.muted}`}>
                    No competitors found for this keyword. Google returned no nearby or text-search
                    results near your business location.
                  </p>
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-6">
          {(audit.reviews.coverage ?? audit.gbp.reviewCoverage) && (
            <ReviewsHealthPanel
              light={isLight}
              coverage={(audit.reviews.coverage ?? audit.gbp.reviewCoverage)!}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReviewStat light={isLight} label="Unresponded negative" value={String(audit.reviews.unrespondedNegative)} />
            <ReviewStat
              light={isLight}
              label="Avg response time"
              value={
                audit.reviews.avgResponseTimeHours != null
                  ? `${audit.reviews.avgResponseTimeHours}h`
                  : "—"
              }
            />
            <ReviewStat light={isLight} label="Pending replies" value={String(audit.reviews.pendingReplies)} />
            <ReviewStat light={isLight} label="Rejected replies" value={String(audit.reviews.rejectedReplies)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className={auditDataTheme(isLight).sectionLabel}>Praise themes</p>
              <TagList light={isLight} items={audit.reviews.sentiment.positiveThemes} color="emerald" />
            </div>
            <div>
              <p className={auditDataTheme(isLight).sectionLabel}>Complaint themes</p>
              <TagList light={isLight} items={audit.reviews.sentiment.negativeThemes} color="red" />
            </div>
          </div>

          <p className={`text-sm ${auditDataTheme(isLight).muted}`}>
            {audit.reviews.reviews.length} reviews collected · Dispute candidates:{" "}
            {audit.reviews.disputeCandidates.length}
          </p>

          <div className="space-y-3">
            {audit.reviews.reviews.slice(0, 20).map((review) => (
              <ReviewCard key={review.id} light={isLight} review={review} />
            ))}
            {audit.reviews.reviews.length > 20 && (
              <p className={auditDataTheme(isLight).empty}>
                Showing 20 of {audit.reviews.reviews.length} reviews.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "trends" && (
        <TrendsPanel
          clientId={clientId}
          keywords={audit.rankings.keywords.map((k) => k.keyword)}
          activeKeyword={activeKeyword}
          onKeywordChange={onKeywordChange}
        />
      )}

    </div>
  );
}

function DataBlock({
  title,
  rows,
  light = false,
}: {
  title: string;
  rows: [string, string][];
  light?: boolean;
}) {
  const theme = auditDataTheme(light);
  return (
    <div className={theme.card}>
      <p className={theme.blockTitle}>{title}</p>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-0.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-4">
            <dt className={theme.label}>{k}</dt>
            <dd className={`break-words sm:text-right ${theme.value}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TagList({
  items,
  color,
  light = false,
}: {
  items: string[];
  color: "emerald" | "red";
  light?: boolean;
}) {
  const theme = auditDataTheme(light);
  const cls = color === "emerald" ? theme.tagEmerald : theme.tagRed;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-1 text-xs ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString();
}

function ReviewStat({
  label,
  value,
  light = false,
}: {
  label: string;
  value: string;
  light?: boolean;
}) {
  const theme = auditDataTheme(light);
  return (
    <div className={theme.card}>
      <p className={theme.metricLabel}>{label}</p>
      <p className={`mt-1 text-lg font-semibold ${theme.value}`}>{value}</p>
    </div>
  );
}

function ReviewCard({ review, light = false }: { review: ReviewRecord; light?: boolean }) {
  const theme = auditDataTheme(light);
  const sentimentColor =
    review.sentiment === "positive"
      ? light
        ? "text-[#137333]"
        : "text-emerald-400"
      : review.sentiment === "negative"
        ? light
          ? "text-[#c5221f]"
          : "text-red-400"
        : light
          ? "text-[#e37400]"
          : "text-amber-400";

  return (
    <div className={theme.card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {review.authorPhotoUrl ? (
            <ExternalImage
              src={review.authorPhotoUrl}
              alt=""
              className={`h-8 w-8 rounded-full object-cover ${light ? "bg-[#e8eaed]" : "bg-white/10"}`}
              fallback={
                <div className={theme.avatarFallback}>
                  {review.isAnonymous ? "?" : review.author.charAt(0)}
                </div>
              }
            />
          ) : (
            <div className={theme.avatarFallback}>
              {review.isAnonymous ? "?" : review.author.charAt(0)}
            </div>
          )}
          <div>
            <p className={`font-medium ${theme.value}`}>
              {review.author}
              <span className={`ml-2 ${light ? "text-[#fbbc04]" : "text-amber-400"}`}>
                {review.rating}★
              </span>
            </p>
            <p className={`text-xs ${theme.label}`}>{formatDate(review.publishedAt)}</p>
          </div>
        </div>
        <span className={`text-xs font-medium uppercase ${sentimentColor}`}>
          {review.sentiment}
        </span>
      </div>

      {review.text && (
        <p className={`mt-3 text-sm leading-relaxed ${theme.body}`}>&ldquo;{review.text}&rdquo;</p>
      )}

      {review.mediaItems && review.mediaItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.mediaItems.map((item, i) => (
            <a
              key={i}
              href={item.videoUrl ?? item.thumbnailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`block overflow-hidden rounded-lg border ${light ? "border-[#dadce0]" : "border-white/10"}`}
            >
              <ExternalImage
                src={item.thumbnailUrl}
                alt={item.thumbnailLabel ?? "Review media"}
                className="h-20 w-20 object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {review.replyText ? (
        <div
          className={`mt-3 rounded-lg border p-3 ${
            light ? "border-[#e8eaed] bg-[#f8f9fa]" : "border-white/8 bg-slate-900/40"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-xs font-semibold uppercase tracking-wider ${theme.label}`}>
              Your reply
            </p>
            {review.replyState && review.replyState !== "APPROVED" && (
              <ReplyStateBadge light={light} state={review.replyState} />
            )}
          </div>
          <p className={`mt-1 text-sm ${theme.muted}`}>{review.replyText}</p>
          {review.policyViolation && (
            <p className={`mt-2 text-xs ${light ? "text-[#c5221f]" : "text-red-400"}`}>
              Policy: {formatViolation(review.policyViolation)}
            </p>
          )}
          {review.responseTimeHours != null && (
            <p className={`mt-1 text-xs ${theme.label}`}>
              Responded in {review.responseTimeHours}h
            </p>
          )}
        </div>
      ) : (
        <p className={`mt-3 text-xs ${light ? "text-[#e37400]" : "text-amber-400"}`}>
          No reply yet
        </p>
      )}
    </div>
  );
}

function ReplyStateBadge({
  state,
  light = false,
}: {
  state: ReviewRecord["replyState"];
  light?: boolean;
}) {
  const styles =
    state === "REJECTED"
      ? light
        ? "bg-[#fce8e6] text-[#c5221f]"
        : "bg-red-500/20 text-red-300"
      : state === "PENDING"
        ? light
          ? "bg-[#fef7e0] text-[#b06000]"
          : "bg-amber-500/20 text-amber-300"
        : light
          ? "bg-[#f1f3f4] text-[#5f6368]"
          : "bg-slate-500/20 text-slate-400";

  const label =
    state === "REJECTED" ? "Rejected" : state === "PENDING" ? "Pending" : state ?? "";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{label}</span>
  );
}

function formatViolation(code: string): string {
  if (!code || code === "POLICY_VIOLATION_UNSPECIFIED") return "";
  return code
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function ReviewsHealthPanel({
  coverage,
  light = false,
}: {
  coverage: GbpReviewCoverage;
  light?: boolean;
}) {
  const report = buildReviewsHealthReport(coverage);
  const theme = auditDataTheme(light);

  return (
    <div className={theme.card}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={theme.heading}>Review management health</p>
          <p className={theme.subheading}>Response rate, reply moderation, and review velocity</p>
        </div>
        <span className={theme.scorePill}>{report.overallScore}%</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
        {[
          { label: "Review list", status: coverage.endpoints.list },
          { label: "Single review", status: coverage.endpoints.get },
        ].map((endpoint) => (
          <div
            key={endpoint.label}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.status === "ok" ? theme.okStatus : theme.warnStatus
            }`}
          >
            <span>{endpoint.label}</span>
            <span className="uppercase">{endpoint.status}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Reviews", value: report.reviewCount },
          { label: "Avg rating", value: `${formatStarRating(report.averageRating)}★` },
          { label: "Response rate", value: `${report.responseRate}%` },
          {
            label: "Avg reply",
            value: report.avgResponseTimeHours != null ? `${report.avgResponseTimeHours}h` : "—",
          },
        ].map((metric) => (
          <div key={metric.label} className={theme.metricBox}>
            <p className={theme.metricLabel}>{metric.label}</p>
            <p className={theme.metricValue}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className={`mb-4 flex flex-wrap gap-2 text-[11px] ${theme.muted}`}>
        <span>{report.unrespondedNegativeCount} unresponded negative</span>
        <span>·</span>
        <span>{report.pendingReplies} pending replies</span>
        <span>·</span>
        <span>{report.rejectedReplies} rejected replies</span>
      </div>

      {report.recommendations.length > 0 && (
        <ul className={`space-y-1.5 ${theme.recommend}`}>
          {report.recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LocalPostsHealthPanel({
  coverage,
  recentPosts,
  light = false,
}: {
  coverage: GbpLocalPostCoverage;
  recentPosts: GbpPostItem[];
  light?: boolean;
}) {
  const report = buildLocalPostsHealthReport(coverage);
  const theme = auditDataTheme(light);

  return (
    <div className={theme.cardWide}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={theme.heading}>Google Posts health</p>
          <p className={theme.subheading}>Posting frequency, topic mix, and engagement signals</p>
        </div>
        <span className={theme.scorePill}>{report.overallScore}%</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
        {[
          { label: "Post list", status: coverage.endpoints.list },
          { label: "Insights", status: coverage.endpoints.insights },
        ].map((endpoint) => (
          <div
            key={endpoint.label}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.status === "ok" ? theme.okStatus : theme.warnStatus
            }`}
          >
            <span>{endpoint.label}</span>
            <span className="uppercase">{endpoint.status}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Live posts", value: report.livePostCount },
          { label: "Last 30d", value: report.postsLast30Days },
          {
            label: "Last post",
            value: report.daysSinceLastPost !== null ? `${report.daysSinceLastPost}d` : "—",
          },
          { label: "Topics", value: report.topicSummary },
        ].map((metric) => (
          <div key={metric.label} className={theme.metricBox}>
            <p className={theme.metricLabel}>{metric.label}</p>
            <p className={theme.metricValue}>{metric.value}</p>
          </div>
        ))}
      </div>

      {recentPosts.length > 0 && (
        <ul className={`mb-4 space-y-2 text-xs ${theme.body}`}>
          {recentPosts.slice(0, 4).map((post) => (
            <li key={post.name ?? post.createTime} className={theme.listItem}>
              <div className={`flex items-center justify-between gap-2 ${theme.label}`}>
                <span>{post.topicType?.toLowerCase() ?? "post"}</span>
                <span>{post.state?.toLowerCase() ?? "live"}</span>
              </div>
              <p className={`mt-1 line-clamp-2 ${theme.body}`}>{post.summary}</p>
            </li>
          ))}
        </ul>
      )}

      {report.recommendations.length > 0 && (
        <ul className={`space-y-1.5 ${theme.recommend}`}>
          {report.recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlaceActionsHealthPanel({
  coverage,
  links,
  light = false,
}: {
  coverage: GbpPlaceActionCoverage;
  links: GbpPlaceActionLinkSummary[];
  light?: boolean;
}) {
  const report = buildPlaceActionsHealthReport(coverage);
  const theme = auditDataTheme(light);

  return (
    <div className={theme.cardWide}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={theme.heading}>Place action links</p>
          <p className={theme.subheading}>
            Booking, ordering, and shop links surfaced on Google Maps
          </p>
        </div>
        <span className={theme.scorePill}>{report.overallScore}%</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
        {[
          { label: "Action links", status: coverage.endpoints.links },
          { label: "Available types", status: coverage.endpoints.typeMetadata },
        ].map((endpoint) => (
          <div
            key={endpoint.label}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.status === "ok" ? theme.okStatus : theme.warnStatus
            }`}
          >
            <span>{endpoint.label}</span>
            <span className="uppercase">{endpoint.status}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { label: "Links", value: report.linkCount },
          { label: "Merchant-owned", value: report.merchantLinkCount },
          { label: "Configured types", value: coverage.configuredTypes.length },
        ].map((metric) => (
          <div key={metric.label} className={theme.metricBox}>
            <p className={theme.metricLabel}>{metric.label}</p>
            <p className={theme.metricValueLg}>{metric.value}</p>
          </div>
        ))}
      </div>

      {report.typeStatus.length > 0 && (
        <ul className={`mb-4 space-y-1.5 text-xs ${theme.body}`}>
          {report.typeStatus.map((item) => (
            <li
              key={item.type}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${theme.listItem}`}
            >
              <span>{item.label}</span>
              <span className={item.configured ? theme.okStatus : theme.warnStatus}>
                {item.configured ? "configured" : item.recommended ? "recommended" : "available"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {links.length > 0 && (
        <ul className={`mb-4 space-y-2 text-xs ${theme.body}`}>
          {links.slice(0, 5).map((link) => (
            <li key={link.name} className={theme.listItem}>
              <div className="flex items-center justify-between gap-2">
                <span>{link.displayType}</span>
                {link.isPreferred && (
                  <span className={light ? "text-[#137333]" : "text-emerald-300"}>preferred</span>
                )}
              </div>
              <p className={`mt-1 truncate ${theme.label}`}>{link.uri}</p>
            </li>
          ))}
        </ul>
      )}

      {report.recommendations.length > 0 && (
        <ul className={`space-y-1.5 ${theme.recommend}`}>
          {report.recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PerformanceHealthPanel({
  coverage,
  light = false,
}: {
  coverage: GbpPerformanceCoverage;
  light?: boolean;
}) {
  const report = buildPerformanceHealthReport(coverage);
  const theme = auditDataTheme(light);

  return (
    <div className={theme.cardWide}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={theme.heading}>Performance health</p>
          <p className={theme.subheading}>
            Google Performance API coverage for actions, views, and search keywords
          </p>
        </div>
        <span className={theme.scorePill}>{report.overallScore}%</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {report.endpointStatus.map((endpoint) => (
          <div
            key={endpoint.key}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.ok ? theme.okStatus : theme.warnStatus
            }`}
          >
            <span>{endpoint.label}</span>
            <span className="uppercase">{endpoint.status}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Actions", value: report.totalActions },
          { label: "Action rate", value: `${report.actionRate}%` },
          { label: "Keywords", value: report.keywordCount },
          { label: "Tracked terms", value: report.trackedKeywordCount },
        ].map((metric) => (
          <div key={metric.label} className={theme.metricBox}>
            <p className={theme.metricLabel}>{metric.label}</p>
            <p className={theme.metricValueLg}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className={`flex flex-wrap gap-2 text-[11px] ${theme.muted}`}>
        <span>{report.apiAvailable ? "API connected" : "API unavailable"}</span>
        {report.partialApi && (
          <>
            <span>·</span>
            <span>partial data</span>
          </>
        )}
        {report.hasConversations && (
          <>
            <span>·</span>
            <span>messages tracked</span>
          </>
        )}
        {report.hasBookings && (
          <>
            <span>·</span>
            <span>bookings tracked</span>
          </>
        )}
      </div>

      {report.recommendations.length > 0 && (
        <ul className={`mt-3 space-y-1.5 ${theme.recommend}`}>
          {report.recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaHealthPanel({
  coverage,
  photosByType,
  videoCount,
  light = false,
}: {
  coverage: GbpMediaCoverage;
  photosByType: Record<string, number>;
  videoCount: number;
  light?: boolean;
}) {
  const report = buildMediaHealthReport(coverage, photosByType);
  const theme = auditDataTheme(light);

  return (
    <div className={theme.cardWide}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={theme.heading}>Media health</p>
          <p className={theme.subheading}>
            Overall score based on coverage, engagement, video, and recency
          </p>
        </div>
        <span className={theme.scorePill}>{report.overallScore}%</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Coverage", value: report.coverageScore },
          { label: "Engagement", value: report.engagementScore },
          { label: "Video", value: report.videoScore },
          { label: "Recency", value: report.recencyScore },
        ].map((metric) => (
          <div key={metric.label} className={theme.metricBox}>
            <p className={theme.metricLabel}>{metric.label}</p>
            <p className={theme.metricValueLg}>{metric.value}%</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {report.categoryStatus.map((item) => (
          <div
            key={item.category}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              item.filled ? theme.okStatus : theme.warnStatus
            }`}
          >
            <span>{item.label}</span>
            <span>{item.filled ? `${item.count || "✓"}` : "Missing"}</span>
          </div>
        ))}
      </div>

      <div className={`flex flex-wrap gap-2 text-[11px] ${theme.muted}`}>
        <span>{report.ownerPhotoCount} owner photos</span>
        <span>·</span>
        <span>{report.customerPhotoCount} customer</span>
        <span>·</span>
        <span>{videoCount} videos</span>
        <span>·</span>
        <span>{report.totalViews.toLocaleString()} views</span>
        {report.daysSinceLastUpload !== null && (
          <>
            <span>·</span>
            <span>last upload {report.daysSinceLastUpload}d ago</span>
          </>
        )}
      </div>

      {report.recommendations.length > 0 && (
        <ul className={`mt-3 space-y-1.5 ${theme.recommend}`}>
          {report.recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaGallery({
  photoCount,
  videoCount,
  photosByType,
  previews,
  coverage,
  light = false,
}: {
  photoCount: number;
  videoCount: number;
  photosByType: Record<string, number>;
  previews: GbpMediaPreview[];
  coverage?: GbpMediaCoverage;
  light?: boolean;
}) {
  const theme = auditDataTheme(light);
  const typeSummary = Object.entries(photosByType)
    .map(([type, count]) => `${type.replace(/_/g, " ").toLowerCase()}: ${count}`)
    .join(" · ");

  const missingSummary = coverage?.missingCategories.length
    ? coverage.missingCategories
        .map((category) => category.replace(/_/g, " ").toLowerCase())
        .join(", ")
    : null;

  return (
    <div className={theme.cardWide}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={theme.heading}>Photos & videos</p>
          <p className={theme.subheading}>
            {photoCount} photos · {videoCount} videos
            {typeSummary ? ` · ${typeSummary}` : ""}
          </p>
          {coverage && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className={theme.pillMuted}>Coverage {coverage.coverageScore}%</span>
              <span className={theme.pillMuted}>Engagement {coverage.engagementScore}%</span>
              <span className={theme.pillMuted}>
                {coverage.ownerPhotoCount} owner · {coverage.customerPhotoCount} customer
                {coverage.customerPhotoShare > 0 ? ` (${coverage.customerPhotoShare}% customer)` : ""}
              </span>
              {coverage.ownerAvgViews > 0 && (
                <span className={theme.pillMuted}>{coverage.ownerAvgViews} avg owner views</span>
              )}
              {coverage.totalViews > 0 && (
                <span className={theme.pillMuted}>
                  {coverage.totalViews.toLocaleString()} views
                </span>
              )}
              {coverage.daysSinceLastUpload !== null && (
                <span className={theme.pillMuted}>
                  Last upload {coverage.daysSinceLastUpload}d ago
                </span>
              )}
            </div>
          )}
          {missingSummary && <p className={`mt-2 text-xs ${theme.recommend}`}>Missing categories: {missingSummary}</p>}
        </div>
        {previews.length > 0 && <p className={`text-xs ${theme.label}`}>Showing {previews.length} previews</p>}
      </div>

      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {previews.map((item, i) => (
            <a
              key={`${item.googleUrl}-${i}`}
              href={item.googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`group relative aspect-square overflow-hidden rounded-lg border ${
                light ? "border-[#dadce0] bg-[#f8f9fa]" : "border-white/10 bg-slate-900/50"
              }`}
              title={item.description || item.category || undefined}
            >
              <ExternalImage
                src={item.thumbnailUrl}
                alt={item.description || item.category || "GBP media"}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              {item.mediaFormat === "VIDEO" && (
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Video
                </span>
              )}
              {item.isCustomerPhoto && (
                <span
                  className="absolute left-1 top-1 max-w-[90%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white"
                  title={item.attributionName ? `Uploaded by ${item.attributionName}` : "Customer photo"}
                >
                  {formatCustomerAttribution(item.attributionName)}
                </span>
              )}
              {typeof item.viewCount === "number" && (
                <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {item.viewCount.toLocaleString()} views
                </span>
              )}
              {item.category && (
                <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {item.category.replace(/_/g, " ").toLowerCase()}
                </span>
              )}
            </a>
          ))}
        </div>
      ) : (
        <p className={theme.empty}>
          {photoCount > 0
            ? "Photo count is available but thumbnails could not be loaded. Re-run the audit or check GBP media permissions."
            : "No media on profile yet."}
        </p>
      )}
    </div>
  );
}
