"use client";

import { useCallback, useEffect, useState } from "react";
import type { GbpReviewCoverage } from "@/audit/types";

interface ReviewPreview {
  reviewId: string;
  reviewer: string;
  rating: number;
  comment: string;
  createTime?: string;
  reviewReply?: {
    comment?: string;
    reviewReplyState?: string;
  };
}

interface ReviewsProbe {
  ok?: boolean;
  partial?: boolean;
  error?: string;
  reviewCount?: number;
  averageRating?: number;
  summary?: string;
  coverage?: GbpReviewCoverage;
  endpoints?: {
    list: string;
    get: string;
  };
}

const ENDPOINT_LABELS = {
  list: "Review list",
  get: "Single review",
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

export default function GbpReviewsSetup({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";
  const [probe, setProbe] = useState<ReviewsProbe | null>(null);
  const [reviews, setReviews] = useState<ReviewPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [probeRes, listRes] = await Promise.all([
        fetch("/api/google/gbp/reviews"),
        fetch("/api/google/gbp/reviews?mode=list&max=6"),
      ]);
      const probeData = await probeRes.json();
      const listData = await listRes.json();

      if (!probeRes.ok) {
        setProbe({ error: probeData.error ?? "Failed to load reviews" });
      } else {
        setProbe(probeData);
      }

      if (listRes.ok) {
        setReviews(
          (listData.reviews ?? []).map((review: ReviewPreview & { name?: string }) => ({
            reviewId: review.reviewId,
            reviewer: review.reviewer,
            rating: review.rating,
            comment: review.comment,
            createTime: review.createTime,
            reviewReply: review.reviewReply,
          }))
        );
      }
    } catch {
      setProbe({ error: "Failed to load reviews" });
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
            Google reviews
          </h2>
          <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
            Review corpus, reply status, and moderation health from the Reviews API.
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
              {coverage.reviewCount} reviews · {coverage.averageRating}★ average ·{" "}
              {coverage.responseRate}% responded
              {coverage.avgResponseTimeHours != null
                ? ` · ${coverage.avgResponseTimeHours}h avg reply`
                : ""}
            </p>
          )}

          {reviews.length > 0 && (
            <ul className={`space-y-2 text-sm ${isLight ? "text-[#3c4043]" : "text-slate-300"}`}>
              {reviews.map((review) => (
                <li
                  key={review.reviewId}
                  className={`rounded-lg border px-3 py-2 ${
                    isLight ? "border-[#e8eaed]" : "border-white/8"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{review.reviewer}</span>
                    <span className="text-xs text-[#80868b]">
                      {review.rating}★
                      {review.reviewReply?.reviewReplyState
                        ? ` · ${review.reviewReply.reviewReplyState.toLowerCase()}`
                        : review.reviewReply?.comment
                          ? " · replied"
                          : ""}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2">{review.comment}</p>
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
