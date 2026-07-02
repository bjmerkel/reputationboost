"use client";

import { useState } from "react";
import type { Phase1AuditPayload } from "@/audit/types";

interface AuditRunnerProps {
  clientId: string;
  initialAudit: Phase1AuditPayload | null;
}

export default function AuditDashboard({ clientId, initialAudit }: AuditRunnerProps) {
  const [audit, setAudit] = useState<Phase1AuditPayload | null>(initialAudit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, trigger: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setAudit(data.audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  if (!audit) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 text-center">
        <p className="text-slate-400">No audit data yet for this client.</p>
        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="btn-primary mt-6 rounded-full px-8 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Running Phase 1…" : "Run Phase 1 Audit"}
        </button>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{audit.clientName}</h2>
          <p className="text-sm text-slate-400">
            {audit.period} · {audit.trigger} audit · {new Date(audit.completedAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Running…" : "Re-run Phase 1"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Local 3-Pack"
          value={`${audit.rankings.keywordsInPack}/${audit.rankings.totalKeywords}`}
          sub="keywords in top 3"
        />
        <StatCard
          label="Share of Voice"
          value={`${audit.rankings.shareOfVoice}%`}
          sub="keywords in pack"
        />
        <StatCard
          label="GBP Completeness"
          value={`${audit.gbp.completeness.completenessScore}%`}
          sub="profile score"
        />
        <StatCard
          label="Engagement (30d)"
          value={`${audit.gbp.performance.calls + audit.gbp.performance.directionRequests}`}
          sub="calls + directions"
        />
      </div>

      <Section title="1A — Google Business Profile">
        <div className="grid gap-4 md:grid-cols-2">
          <DataBlock title="Identity" rows={[
            ["Name", audit.gbp.identity.name],
            ["Category", audit.gbp.identity.primaryCategory],
            ["Phone", audit.gbp.identity.phone],
            ["Website", audit.gbp.identity.website],
          ]} />
          <DataBlock title="Content & Issues" rows={[
            ["Photos", String(audit.gbp.content.photoCount)],
            ["Last post", formatDate(audit.gbp.content.lastPostDate)],
            ["Unanswered Q&A", String(audit.gbp.content.unansweredQa)],
            ["Verified", audit.gbp.issues.isVerified ? "Yes" : "No"],
          ]} />
          <DataBlock title="Engagement" rows={[
            ["Reviews", `${audit.gbp.engagement.reviewCount} (${audit.gbp.engagement.averageRating}★)`],
            ["New (30d)", String(audit.gbp.engagement.reviewsLast30Days)],
            ["Response rate", `${Math.round(audit.gbp.engagement.responseRate * 100)}%`],
          ]} />
          <DataBlock title="Performance (30d)" rows={[
            ["Calls", String(audit.gbp.performance.calls)],
            ["Directions", String(audit.gbp.performance.directionRequests)],
            ["Website clicks", String(audit.gbp.performance.websiteClicks)],
          ]} />
        </div>
      </Section>

      <Section title="1B — Rank & Visibility">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-3 pr-4">Keyword</th>
                <th className="pb-3 pr-4">3-Pack</th>
                <th className="pb-3 pr-4">1 mi</th>
                <th className="pb-3 pr-4">3 mi</th>
                <th className="pb-3 pr-4">5 mi</th>
                <th className="pb-3">10 mi</th>
              </tr>
            </thead>
            <tbody>
              {audit.rankings.keywords.map((kw) => (
                <tr key={kw.keyword} className="border-b border-white/5">
                  <td className="py-3 pr-4 text-white">{kw.keyword}</td>
                  <td className="py-3 pr-4">
                    <PackBadge inPack={kw.inLocalPack} position={kw.localPackPosition} />
                  </td>
                  {kw.geoRanks.map((g) => (
                    <td key={g.distanceMiles} className="py-3 pr-4 text-slate-300">
                      {g.rank ? `#${g.rank}` : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="1C — Competitor Intelligence">
        {audit.competitors.map((snap) => (
          <div key={snap.keyword} className="mb-6 last:mb-0">
            <h4 className="mb-3 font-semibold text-emerald-400">{snap.keyword}</h4>
            <div className="space-y-2">
              {snap.competitors.slice(0, 3).map((c, i) => (
                <div
                  key={c.placeId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-4 py-3"
                >
                  <span className="text-white">
                    #{i + 1} {c.name}
                  </span>
                  <span className="text-sm text-slate-400">
                    {c.averageRating}★ · {c.reviewCount} reviews · {c.postsLast30Days} posts/mo
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="1D — Reputation & Sentiment">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Praise themes</p>
            <TagList items={audit.reviews.sentiment.positiveThemes} color="emerald" />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Complaint themes</p>
            <TagList items={audit.reviews.sentiment.negativeThemes} color="red" />
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Unresponded negative reviews: {audit.reviews.unrespondedNegative} ·
          Dispute candidates: {audit.reviews.disputeCandidates.length}
        </p>
      </Section>

      <Section title="1E — Off-Google Signals">
        <DataBlock
          title="Citations"
          rows={[
            ["Consistency score", `${audit.offGoogle.citationConsistencyScore}%`],
            ["NAP on website", audit.offGoogle.website.napMatch ? "Match" : "Mismatch"],
            ["LocalBusiness schema", audit.offGoogle.website.hasLocalBusinessSchema ? "Yes" : "Missing"],
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
      </Section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>
      {children}
    </section>
  );
}

function DataBlock({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-4">
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
    return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">Not in pack</span>;
  }
  return (
    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
      #{position}
    </span>
  );
}

function TagList({ items, color }: { items: string[]; color: "emerald" | "red" }) {
  const cls = color === "emerald" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300";
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
