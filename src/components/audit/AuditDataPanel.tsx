"use client";

import { useState } from "react";
import type { FullAuditPayload } from "@/audit/types";
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
}: {
  audit: FullAuditPayload;
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<DataTab>("profile");

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-xl font-bold text-white">Audit data</h2>
          <p className="mt-1 text-sm text-slate-400">
            Raw signals collected from Google Maps, your GBP, and off-platform sources.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-white/8 pb-3">
        {DATA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-white/10 text-white"
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
        </div>
      )}

      {tab === "rankings" && (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400">
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
                <tr key={kw.keyword} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">{kw.keyword}</td>
                  <td className="px-4 py-3">
                    <PackBadge inPack={kw.inLocalPack} position={kw.localPackPosition} />
                  </td>
                  {kw.geoRanks.map((g) => (
                    <td key={g.distanceMiles} className="px-4 py-3 text-slate-300">
                      {g.rank ? `#${g.rank}` : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
        <div className="space-y-4">
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
            Unresponded negative reviews: {audit.reviews.unrespondedNegative} · Dispute
            candidates: {audit.reviews.disputeCandidates.length}
          </p>
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
}: {
  inPack: boolean;
  position: number | string;
}) {
  if (!inPack) {
    return (
      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
        Not in pack
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
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
