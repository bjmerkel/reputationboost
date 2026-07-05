"use client";

import { useCallback, useEffect, useState } from "react";
import type { GbpLocalPostCoverage } from "@/audit/types";

interface LocalPostPreview {
  name: string;
  summary: string;
  topicType?: string;
  state?: string;
  createTime?: string;
  searchUrl?: string;
}

interface LocalPostsProbe {
  ok?: boolean;
  partial?: boolean;
  error?: string;
  postCount?: number;
  summary?: string;
  coverage?: GbpLocalPostCoverage;
  endpoints?: {
    list: string;
    insights: string;
  };
}

const ENDPOINT_LABELS = {
  list: "Post list",
  insights: "Post insights",
} as const;

function endpointBadgeClass(status: string, isLight: boolean): string {
  if (status === "ok") {
    return isLight ? "bg-[#e6f4ea] text-[#137333]" : "bg-emerald-500/15 text-emerald-300";
  }
  if (status === "denied") {
    return isLight ? "bg-[#fce8e6] text-[#c5221f]" : "bg-red-500/15 text-red-300";
  }
  if (status === "failed") {
    return isLight ? "bg-[#fef7e0] text-[#e37400]" : "bg-amber-500/15 text-amber-300";
  }
  return isLight ? "bg-[#f1f3f4] text-[#5f6368]" : "bg-white/10 text-slate-400";
}

function formatPostDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function GbpLocalPostsSetup({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";
  const [probe, setProbe] = useState<LocalPostsProbe | null>(null);
  const [posts, setPosts] = useState<LocalPostPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [probeRes, listRes] = await Promise.all([
        fetch("/api/google/gbp/local-posts"),
        fetch("/api/google/gbp/local-posts?mode=list"),
      ]);
      const probeData = await probeRes.json();
      const listData = await listRes.json();

      if (!probeRes.ok) {
        setProbe({ error: probeData.error ?? "Failed to load Google Posts" });
      } else {
        setProbe(probeData);
      }

      if (listRes.ok) {
        setPosts((listData.posts ?? []).slice(0, 6));
      }
    } catch {
      setProbe({ error: "Failed to load Google Posts" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const coverage = probe?.coverage;

  return (
    <div
      className={`rounded-xl border p-6 shadow-sm ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-bold ${isLight ? "text-[#202124]" : "text-white"}`}>
            Google Posts
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Updates, events, offers, and alerts on your Business Profile.
          </p>
        </div>
        {!loading && coverage && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              coverage.coverageScore >= 70
                ? "bg-[#e6f4ea] text-[#137333]"
                : "bg-[#fef7e0] text-[#e37400]"
            }`}
          >
            {coverage.coverageScore}% coverage
          </span>
        )}
      </div>

      {loading ? (
        <p className={`mt-4 text-sm ${isLight ? "text-[#80868b]" : "text-slate-500"}`}>Checking…</p>
      ) : probe?.error ? (
        <p className="mt-4 text-sm text-[#d93025]">{probe.error}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {probe?.endpoints && (
            <dl className={`space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              {(Object.keys(ENDPOINT_LABELS) as Array<keyof typeof ENDPOINT_LABELS>).map((key) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <dt className={isLight ? "text-[#80868b]" : "text-slate-500"}>
                    {ENDPOINT_LABELS[key]}
                  </dt>
                  <dd>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${endpointBadgeClass(
                        probe.endpoints![key],
                        isLight
                      )}`}
                    >
                      {probe.endpoints![key]}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {coverage && (
            <p className={`text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              {coverage.livePostCount} live · {coverage.postsLast30Days} in last 30 days
              {coverage.daysSinceLastPost !== null
                ? ` · last post ${coverage.daysSinceLastPost}d ago`
                : ""}
            </p>
          )}

          {posts.length > 0 && (
            <ul className={`space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              {posts.map((post) => (
                <li
                  key={post.name}
                  className={`rounded-lg border px-3 py-2 ${
                    isLight ? "border-[#e8eaed]" : "border-white/8"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-[#80868b]">
                      {post.topicType?.replace(/_/g, " ").toLowerCase() ?? "post"}
                      {post.state ? ` · ${post.state.toLowerCase()}` : ""}
                    </span>
                    <span className="text-xs text-[#80868b]">{formatPostDate(post.createTime)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2">{post.summary}</p>
                </li>
              ))}
            </ul>
          )}

          {coverage?.recommendations.length ? (
            <ul className={`space-y-1.5 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
              {coverage.recommendations.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
