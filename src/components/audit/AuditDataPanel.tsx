"use client";

import { useEffect, useState } from "react";
import type { FullAuditPayload, GbpMediaPreview, ReviewRecord } from "@/audit/types";
import ExternalImage from "@/components/ExternalImage";
import GoogleMapsLink from "@/components/GoogleMapsLink";

type DataTab = "profile" | "rankings" | "competitors" | "reviews" | "citations";

const DATA_TABS: { id: DataTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "rankings", label: "Rankings" },
  { id: "competitors", label: "Competitors" },
  { id: "reviews", label: "Reviews" },
  { id: "citations", label: "Citations" },
];

export default function AuditDataPanel({
  audit,
  embedded = false,
  variant = "dark",
  gbpConnected = false,
}: {
  audit: FullAuditPayload;
  embedded?: boolean;
  variant?: "dark" | "light";
  gbpConnected?: boolean;
}) {
  const isLight = variant === "light";
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
            thumbnailUrl?: string;
            googleUrl?: string;
            mediaFormat?: string;
            category?: string | null;
            description?: string;
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
              ["Unanswered Q&A", String(audit.gbp.content.unansweredQa)],
              ["Verified", audit.gbp.issues.isVerified ? "Yes" : "No"],
              ["Completeness", `${audit.gbp.completeness.completenessScore}%`],
            ]}
          />
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

          {(audit.gbp.content.photoCount > 0 || mediaPreviews.length > 0) && (
            <MediaGallery
              photoCount={audit.gbp.content.photoCount}
              videoCount={audit.gbp.content.videoCount ?? 0}
              photosByType={audit.gbp.content.photosByType}
              previews={mediaPreviews}
            />
          )}
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
              {audit.rankings.keywords.map((kw) => (
                <tr
                  key={kw.keyword}
                  className={`border-b ${isLight ? "border-[#f1f3f4]" : "border-white/5"}`}
                >
                  <td className={`px-4 py-3 ${isLight ? "text-[#202124]" : "text-white"}`}>
                    {kw.keyword}
                  </td>
                  <td className="px-4 py-3">
                    <PackBadge inPack={kw.inLocalPack} position={kw.localPackPosition} light={isLight} />
                  </td>
                  {kw.geoRanks.map((g) => (
                    <td
                      key={g.distanceMiles}
                      className={`px-4 py-3 ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}
                    >
                      {g.rank ? `#${g.rank}` : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {tab === "competitors" && (
        <div className="space-y-6">
          {audit.competitors.map((snap) => (
            <div key={snap.keyword}>
              <h4 className="mb-3 font-semibold text-emerald-400">{snap.keyword}</h4>
              <div className="space-y-2">
                {snap.competitors.slice(0, 5).map((c, i) => (
                  <div
                    key={c.placeId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3"
                  >
                    <span className="text-white">
                      #{i + 1} {c.name}
                    </span>
                    <span className="text-sm text-slate-400">
                      {c.averageRating}★ · {c.reviewCount} reviews · {c.postsLast30Days}{" "}
                      posts/mo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-6">
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

function MediaGallery({
  photoCount,
  videoCount,
  photosByType,
  previews,
}: {
  photoCount: number;
  videoCount: number;
  photosByType: Record<string, number>;
  previews: GbpMediaPreview[];
}) {
  const typeSummary = Object.entries(photosByType)
    .map(([type, count]) => `${type.replace(/_/g, " ").toLowerCase()}: ${count}`)
    .join(" · ");

  return (
    <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Photos & videos</p>
          <p className="mt-1 text-xs text-slate-500">
            {photoCount} photos · {videoCount} videos
            {typeSummary ? ` · ${typeSummary}` : ""}
          </p>
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
