"use client";

import { useEffect, useMemo, useState } from "react";
import type {
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
import { buildFieldAttributionCalibration } from "@/audit/phase2/field-attribution-calibration";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { formatCustomerAttribution } from "@/lib/google/gbp-media-display";
import { buildMediaHealthReport } from "@/lib/google/gbp-media-health";
import { buildPerformanceHealthReport } from "@/lib/google/gbp-performance-health";
import { buildReviewsHealthReport } from "@/lib/google/gbp-reviews-health";
import { buildLocalPostsHealthReport } from "@/lib/google/gbp-local-posts-health";
import { buildPlaceActionsHealthReport } from "@/lib/google/gbp-place-actions-health";
import { competitorMapRank } from "@/lib/google/local-rankings";
import { detectPackFragility } from "@/audit/phase2/scoring";

type DataTab = "profile" | "rankings" | "competitors" | "reviews" | "citations" | "trends";

const DATA_TABS: { id: DataTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "rankings", label: "Rankings" },
  { id: "trends", label: "Trends" },
  { id: "competitors", label: "Competitors" },
  { id: "reviews", label: "Reviews" },
  { id: "citations", label: "Citations" },
];

export default function AuditDataPanel({
  audit,
  clientId,
  tasks = [],
  activeKeyword,
  onKeywordChange,
  embedded = false,
  variant = "dark",
  gbpConnected = false,
  onNavigateToPlan,
  attributions = [],
  globalCalibration = {},
}: {
  audit: FullAuditPayload;
  clientId: string;
  tasks?: ExecutionTask[];
  activeKeyword: string;
  onKeywordChange: (keyword: string) => void;
  embedded?: boolean;
  variant?: "dark" | "light";
  gbpConnected?: boolean;
  onNavigateToPlan?: (stepNumber: number, scrollTarget?: "google-updates") => void;
  attributions?: ActionAttribution[];
  globalCalibration?: AttributionCalibration;
}) {
  const isLight = variant === "light";
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
          .map((item) => ({
            thumbnailUrl: item.thumbnailUrl || item.googleUrl || "",
            googleUrl: item.googleUrl || item.thumbnailUrl || "",
            mediaFormat: item.mediaFormat === "VIDEO" ? "VIDEO" : "PHOTO",
            category: item.category ?? null,
            description: item.description || undefined,
            name: item.name,
            viewCount: Number(item.insights?.viewCount ?? item.viewCount ?? 0),
            isCustomerPhoto: Boolean(item.attribution?.profileName),
            attributionName: item.attribution?.profileName || undefined,
          }));

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

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className={`text-xl font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Audit data
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Raw signals collected from Google Maps, your GBP, and off-platform sources.
          </p>
        </div>
      )}

      <div
        className={`flex flex-wrap gap-2 border-b pb-3 ${
          isLight ? "border-[#dadce0]" : "border-white/8"
        }`}
      >
        {DATA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
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
          <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <DataBlock
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
            title="Engagement"
            rows={[
              [
                "Reviews",
                `${audit.gbp.engagement.reviewCount} (${audit.gbp.engagement.averageRating}★)`,
              ],
              ["New (30d)", String(audit.gbp.engagement.reviewsLast30Days)],
              ["Response rate", `${Math.round(audit.gbp.engagement.responseRate * 100)}%`],
            ]}
          />
          <DataBlock
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
          {(audit.gbp.performance.searchKeywords?.length ?? 0) > 0 && (
            <DataBlock
              title="Search keywords (Google)"
              rows={audit.gbp.performance.searchKeywords!.slice(0, 12).map((kw) => [
                kw.keyword,
                kw.belowThreshold
                  ? "< threshold"
                  : String(kw.impressions ?? 0) + " impressions",
              ])}
            />
          )}

          {audit.gbp.performance.coverage && (
            <PerformanceHealthPanel coverage={audit.gbp.performance.coverage} />
          )}

          {audit.gbp.placeActions && (
            <PlaceActionsHealthPanel
              coverage={audit.gbp.placeActions}
              links={audit.gbp.placeActionLinks ?? []}
            />
          )}

          {audit.gbp.localPosts && (
            <LocalPostsHealthPanel
              coverage={audit.gbp.localPosts}
              recentPosts={audit.gbp.recentPosts ?? []}
            />
          )}

          {(audit.gbp.content.photoCount > 0 || mediaPreviews.length > 0) && (
            <>
              {audit.gbp.content.mediaCoverage && (
                <MediaHealthPanel
                  coverage={audit.gbp.content.mediaCoverage}
                  photosByType={audit.gbp.content.photosByType}
                  videoCount={audit.gbp.content.videoCount ?? 0}
                />
              )}
              <MediaGallery
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

      {tab === "rankings" && (
        <div className="space-y-3">
          <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Rankings by search radius from your business. Toggle <strong>Heatmap</strong> on the
            map for the full geo grid view.
          </p>
        <div
          className={`overflow-x-auto rounded-xl border ${
            isLight ? "border-[#dadce0]" : "border-white/8"
          }`}
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr
                className={`border-b text-xs uppercase tracking-wider ${
                  isLight
                    ? "border-[#dadce0] bg-[#f8f9fa] text-[#5f6368]"
                    : "border-white/10 bg-white/[0.02] text-slate-400"
                }`}
              >
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">3-Pack</th>
                <th className="px-4 py-3">1 mi</th>
                <th className="px-4 py-3">3 mi</th>
                <th className="px-4 py-3">5 mi</th>
                <th className="px-4 py-3">10 mi</th>
              </tr>
            </thead>
            <tbody>
              {audit.rankings.keywords.map((kw) => {
                const fragility = detectPackFragility(kw);
                return (
                <tr
                  key={kw.keyword}
                  className={`border-b ${isLight ? "border-[#f1f3f4]" : "border-white/5"}`}
                >
                  <td className={`px-4 py-3 ${isLight ? "text-[#202124]" : "text-white"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{kw.keyword}</span>
                      {fragility.fragile && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            isLight ? "bg-[#fef7e0] text-[#b06000]" : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          Fragile
                          {fragility.weakestRadiusMiles != null
                            ? ` by ${fragility.weakestRadiusMiles} mi`
                            : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PackBadge inPack={kw.inLocalPack} position={kw.localPackPosition} light={isLight} />
                  </td>
                  {kw.geoRanks.map((g) => {
                    const inPack = g.inLocalPack ?? (typeof g.rank === "number" && g.rank <= 3);
                    const isWeakest =
                      fragility.fragile &&
                      fragility.weakestRadiusMiles != null &&
                      g.distanceMiles === fragility.weakestRadiusMiles;
                    return (
                    <td
                      key={g.distanceMiles}
                      className={`px-4 py-3 ${
                        inPack
                          ? isLight
                            ? "text-[#137333]"
                            : "text-emerald-400"
                          : isWeakest
                            ? isLight
                              ? "bg-[#fef7e0] font-medium text-[#b06000]"
                              : "bg-amber-500/10 font-medium text-amber-300"
                            : isLight
                              ? "text-[#c5221f]"
                              : "text-red-400"
                      }`}
                    >
                      {g.rank ? `#${g.rank}` : "—"}
                    </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {tab === "competitors" && (
        <div className="space-y-6">
          <p className="text-sm text-slate-400">
            Top competitors from the same Nearby Search used for your pack position. Rank numbers
            match Google&apos;s ordering — when you&apos;re in the pack, competitors below show
            their true Maps position (e.g. #2, #3).
          </p>
          {audit.competitors.map((snap) => {
            const keywordRank = audit.rankings.keywords.find((k) => k.keyword === snap.keyword);
            return (
            <div key={snap.keyword}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h4 className="font-semibold text-emerald-400">{snap.keyword}</h4>
                {keywordRank?.inLocalPack && typeof keywordRank.localPackPosition === "number" ? (
                  <span className="text-sm text-slate-400">
                    Your business: #{keywordRank.localPackPosition} in Local 3-Pack
                  </span>
                ) : keywordRank && !keywordRank.inLocalPack ? (
                  <span className="text-sm text-slate-400">Your business: outside 3-Pack</span>
                ) : null}
              </div>
              <div className="space-y-2">
                {snap.competitors.slice(0, 5).map((c, i) => (
                  <div
                    key={c.placeId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3"
                  >
                    <span className="text-white">
                      #{competitorMapRank(c.mapPositions, snap.keyword, i)} {c.name}
                    </span>
                    <span className="text-sm text-slate-400">
                      {c.averageRating}★ · {c.reviewCount} reviews · {c.postsLast30Days}{" "}
                      posts/mo
                    </span>
                  </div>
                ))}
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
              coverage={(audit.reviews.coverage ?? audit.gbp.reviewCoverage)!}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReviewStat label="Unresponded negative" value={String(audit.reviews.unrespondedNegative)} />
            <ReviewStat
              label="Avg response time"
              value={
                audit.reviews.avgResponseTimeHours != null
                  ? `${audit.reviews.avgResponseTimeHours}h`
                  : "—"
              }
            />
            <ReviewStat label="Pending replies" value={String(audit.reviews.pendingReplies)} />
            <ReviewStat label="Rejected replies" value={String(audit.reviews.rejectedReplies)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">
                Praise themes
              </p>
              <TagList items={audit.reviews.sentiment.positiveThemes} color="emerald" />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">
                Complaint themes
              </p>
              <TagList items={audit.reviews.sentiment.negativeThemes} color="red" />
            </div>
          </div>

          <p className="text-sm text-slate-400">
            {audit.reviews.reviews.length} reviews collected · Dispute candidates:{" "}
            {audit.reviews.disputeCandidates.length}
          </p>

          <div className="space-y-3">
            {audit.reviews.reviews.slice(0, 20).map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
            {audit.reviews.reviews.length > 20 && (
              <p className="text-sm text-slate-500">
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

      {tab === "citations" && (
        <div>
          <DataBlock
            title="Off-Google signals"
            rows={[
              ["Citation consistency", `${audit.offGoogle.citationConsistencyScore}%`],
              ["NAP on website", audit.offGoogle.website.napMatch ? "Match" : "Mismatch"],
              [
                "LocalBusiness schema",
                audit.offGoogle.website.hasLocalBusinessSchema ? "Yes" : "Missing",
              ],
              ["Social posts (30d)", String(audit.offGoogle.socialPostCountLast30Days)],
            ]}
          />
          {audit.offGoogle.website.issues.length > 0 && (
            <ul className="mt-4 list-inside list-disc text-sm text-amber-400/90">
              {audit.offGoogle.website.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DataBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <p className="mb-3 text-sm font-semibold text-slate-300">{title}</p>
      <dl className="space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-right text-slate-200">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PackBadge({
  inPack,
  position,
  light = false,
}: {
  inPack: boolean;
  position: number | string;
  light?: boolean;
}) {
  if (!inPack) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          light ? "bg-[#fce8e6] text-[#c5221f]" : "bg-red-500/20 text-red-400"
        }`}
      >
        Not in pack
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        light ? "bg-[#e6f4ea] text-[#137333]" : "bg-emerald-500/20 text-emerald-400"
      }`}
    >
      #{position}
    </span>
  );
}

function TagList({ items, color }: { items: string[]; color: "emerald" | "red" }) {
  const cls =
    color === "emerald" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300";
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

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewRecord }) {
  const sentimentColor =
    review.sentiment === "positive"
      ? "text-emerald-400"
      : review.sentiment === "negative"
        ? "text-red-400"
        : "text-amber-400";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {review.authorPhotoUrl ? (
            <ExternalImage
              src={review.authorPhotoUrl}
              alt=""
              className="h-8 w-8 rounded-full bg-white/10 object-cover"
              fallback={
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs text-slate-400">
                  {review.isAnonymous ? "?" : review.author.charAt(0)}
                </div>
              }
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs text-slate-400">
              {review.isAnonymous ? "?" : review.author.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-medium text-white">
              {review.author}
              <span className="ml-2 text-amber-400">{review.rating}★</span>
            </p>
            <p className="text-xs text-slate-500">{formatDate(review.publishedAt)}</p>
          </div>
        </div>
        <span className={`text-xs font-medium uppercase ${sentimentColor}`}>
          {review.sentiment}
        </span>
      </div>

      {review.text && (
        <p className="mt-3 text-sm leading-relaxed text-slate-300">&ldquo;{review.text}&rdquo;</p>
      )}

      {review.mediaItems && review.mediaItems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.mediaItems.map((item, i) => (
            <a
              key={i}
              href={item.videoUrl ?? item.thumbnailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-white/10"
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
        <div className="mt-3 rounded-lg border border-white/8 bg-slate-900/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your reply
            </p>
            {review.replyState && review.replyState !== "APPROVED" && (
              <ReplyStateBadge state={review.replyState} />
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">{review.replyText}</p>
          {review.policyViolation && (
            <p className="mt-2 text-xs text-red-400">
              Policy: {formatViolation(review.policyViolation)}
            </p>
          )}
          {review.responseTimeHours != null && (
            <p className="mt-1 text-xs text-slate-500">
              Responded in {review.responseTimeHours}h
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-400">No reply yet</p>
      )}
    </div>
  );
}

function ReplyStateBadge({ state }: { state: ReviewRecord["replyState"] }) {
  const styles =
    state === "REJECTED"
      ? "bg-red-500/20 text-red-300"
      : state === "PENDING"
        ? "bg-amber-500/20 text-amber-300"
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

function ReviewsHealthPanel({ coverage }: { coverage: GbpReviewCoverage }) {
  const report = buildReviewsHealthReport(coverage);

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Review management health</p>
          <p className="mt-1 text-xs text-slate-500">
            Response rate, reply moderation, and review velocity
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
          {report.overallScore}%
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
        {[
          { label: "Review list", status: coverage.endpoints.list },
          { label: "Single review", status: coverage.endpoints.get },
        ].map((endpoint) => (
          <div
            key={endpoint.label}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.status === "ok"
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-300"
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
          { label: "Avg rating", value: `${report.averageRating}★` },
          { label: "Response rate", value: `${report.responseRate}%` },
          {
            label: "Avg reply",
            value: report.avgResponseTimeHours != null ? `${report.avgResponseTimeHours}h` : "—",
          },
        ].map((metric) => (
          <div key={metric.label} className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="text-sm font-semibold text-slate-200">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span>{report.unrespondedNegativeCount} unresponded negative</span>
        <span>·</span>
        <span>{report.pendingReplies} pending replies</span>
        <span>·</span>
        <span>{report.rejectedReplies} rejected replies</span>
      </div>

      {report.recommendations.length > 0 && (
        <ul className="space-y-1.5 text-xs text-amber-300/90">
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
}: {
  coverage: GbpLocalPostCoverage;
  recentPosts: GbpPostItem[];
}) {
  const report = buildLocalPostsHealthReport(coverage);

  return (
    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Google Posts health</p>
          <p className="mt-1 text-xs text-slate-500">
            Posting frequency, topic mix, and engagement signals
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
          {report.overallScore}%
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
        {[
          { label: "Post list", status: coverage.endpoints.list },
          { label: "Insights", status: coverage.endpoints.insights },
        ].map((endpoint) => (
          <div
            key={endpoint.label}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.status === "ok"
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-300"
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
          <div key={metric.label} className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="text-sm font-semibold text-slate-200">{metric.value}</p>
          </div>
        ))}
      </div>

      {recentPosts.length > 0 && (
        <ul className="mb-4 space-y-2 text-xs text-slate-300">
          {recentPosts.slice(0, 4).map((post) => (
            <li key={post.name ?? post.createTime} className="rounded-lg bg-white/5 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-slate-500">
                <span>{post.topicType?.toLowerCase() ?? "post"}</span>
                <span>{post.state?.toLowerCase() ?? "live"}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-slate-300">{post.summary}</p>
            </li>
          ))}
        </ul>
      )}

      {report.recommendations.length > 0 && (
        <ul className="space-y-1.5 text-xs text-amber-300/90">
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
}: {
  coverage: GbpPlaceActionCoverage;
  links: GbpPlaceActionLinkSummary[];
}) {
  const report = buildPlaceActionsHealthReport(coverage);

  return (
    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Place action links</p>
          <p className="mt-1 text-xs text-slate-500">
            Booking, ordering, and shop links surfaced on Google Maps
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
          {report.overallScore}%
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
        {[
          { label: "Action links", status: coverage.endpoints.links },
          { label: "Available types", status: coverage.endpoints.typeMetadata },
        ].map((endpoint) => (
          <div
            key={endpoint.label}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.status === "ok"
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-300"
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
          <div key={metric.label} className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="text-lg font-semibold text-slate-200">{metric.value}</p>
          </div>
        ))}
      </div>

      {links.length > 0 && (
        <ul className="mb-4 space-y-2 text-xs text-slate-300">
          {links.slice(0, 5).map((link) => (
            <li key={link.name} className="rounded-lg bg-white/5 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span>{link.displayType}</span>
                {link.isPreferred && <span className="text-emerald-300">preferred</span>}
              </div>
              <p className="mt-1 truncate text-slate-500">{link.uri}</p>
            </li>
          ))}
        </ul>
      )}

      {report.recommendations.length > 0 && (
        <ul className="space-y-1.5 text-xs text-amber-300/90">
          {report.recommendations.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PerformanceHealthPanel({ coverage }: { coverage: GbpPerformanceCoverage }) {
  const report = buildPerformanceHealthReport(coverage);

  return (
    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Performance health</p>
          <p className="mt-1 text-xs text-slate-500">
            Google Performance API coverage for actions, views, and search keywords
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
          {report.overallScore}%
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {report.endpointStatus.map((endpoint) => (
          <div
            key={endpoint.key}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              endpoint.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
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
          <div key={metric.label} className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="text-lg font-semibold text-slate-200">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
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
        <ul className="mt-3 space-y-1.5 text-xs text-amber-300/90">
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
}: {
  coverage: GbpMediaCoverage;
  photosByType: Record<string, number>;
  videoCount: number;
}) {
  const report = buildMediaHealthReport(coverage, photosByType);

  return (
    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Media health</p>
          <p className="mt-1 text-xs text-slate-500">
            Overall score based on coverage, engagement, video, and recency
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
          {report.overallScore}%
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Coverage", value: report.coverageScore },
          { label: "Engagement", value: report.engagementScore },
          { label: "Video", value: report.videoScore },
          { label: "Recency", value: report.recencyScore },
        ].map((metric) => (
          <div key={metric.label} className="rounded-lg bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="text-lg font-semibold text-slate-200">{metric.value}%</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {report.categoryStatus.map((item) => (
          <div
            key={item.category}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
              item.filled ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"
            }`}
          >
            <span>{item.label}</span>
            <span>{item.filled ? `${item.count || "✓"}` : "Missing"}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
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
        <ul className="mt-3 space-y-1.5 text-xs text-amber-300/90">
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
}: {
  photoCount: number;
  videoCount: number;
  photosByType: Record<string, number>;
  previews: GbpMediaPreview[];
  coverage?: GbpMediaCoverage;
}) {
  const typeSummary = Object.entries(photosByType)
    .map(([type, count]) => `${type.replace(/_/g, " ").toLowerCase()}: ${count}`)
    .join(" · ");

  const missingSummary = coverage?.missingCategories.length
    ? coverage.missingCategories
        .map((category) => category.replace(/_/g, " ").toLowerCase())
        .join(", ")
    : null;

  return (
    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Photos & videos</p>
          <p className="mt-1 text-xs text-slate-500">
            {photoCount} photos · {videoCount} videos
            {typeSummary ? ` · ${typeSummary}` : ""}
          </p>
          {coverage && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300">
                Coverage {coverage.coverageScore}%
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300">
                Engagement {coverage.engagementScore}%
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">
                {coverage.ownerPhotoCount} owner · {coverage.customerPhotoCount} customer
                {coverage.customerPhotoShare > 0 ? ` (${coverage.customerPhotoShare}% customer)` : ""}
              </span>
              {coverage.ownerAvgViews > 0 && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">
                  {coverage.ownerAvgViews} avg owner views
                </span>
              )}
              {coverage.totalViews > 0 && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">
                  {coverage.totalViews.toLocaleString()} views
                </span>
              )}
              {coverage.daysSinceLastUpload !== null && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">
                  Last upload {coverage.daysSinceLastUpload}d ago
                </span>
              )}
            </div>
          )}
          {missingSummary && (
            <p className="mt-2 text-xs text-amber-300/90">
              Missing categories: {missingSummary}
            </p>
          )}
        </div>
        {previews.length > 0 && (
          <p className="text-xs text-slate-500">Showing {previews.length} previews</p>
        )}
      </div>

      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {previews.map((item, i) => (
            <a
              key={`${item.googleUrl}-${i}`}
              href={item.googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-slate-900/50"
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
              {typeof item.viewCount === "number" && item.viewCount > 0 && (
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
        <p className="text-sm text-slate-500">
          {photoCount > 0
            ? "Photo count is available but thumbnails could not be loaded. Re-run the audit or check GBP media permissions."
            : "No media on profile yet."}
        </p>
      )}
    </div>
  );
}
