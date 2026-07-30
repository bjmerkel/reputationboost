"use client";

import Link from "next/link";
import type { FullAuditPayload } from "@/audit/types";
import { keywordReviewGap } from "@/audit/phase2/review-velocity";
import { resolveReviewResponseRate } from "@/audit/review-engagement";
import type { ProfileGuideReadiness } from "@/lib/profile-guide/readiness";
import { profileGuideEditorHref } from "@/lib/profile-guide/readiness";

function topReviewGapKeyword(audit: FullAuditPayload): {
  keyword: string;
  gap: number;
} | null {
  const ranked = [...audit.rankings.keywords]
    .map((keyword) => ({
      keyword: keyword.keyword,
      gap: keywordReviewGap(keyword),
    }))
    .filter((item) => item.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  return ranked[0] ?? null;
}

export default function ReputationLeversCard({
  audit,
  readiness,
  businessId,
  gbpConnected = true,
  onNavigateToPlan,
}: {
  audit: FullAuditPayload;
  readiness: ProfileGuideReadiness;
  businessId?: string | null;
  gbpConnected?: boolean;
  onNavigateToPlan?: (stepNumber: number) => void;
}) {
  if (!gbpConnected) return null;

  const reviewGap = topReviewGapKeyword(audit);
  const responseRate = Math.round(resolveReviewResponseRate(audit) * 100);
  const profileGuideHref = profileGuideEditorHref(businessId, { from: "home", focus: "publish" });

  return (
    <div className="mt-4 border-t border-[#e8eaed] pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
        Reputation levers
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-3">
          <p className="text-xs font-medium text-[#80868b]">Profile Guide</p>
          <p className="mt-1 text-sm font-semibold text-[#202124]">
            {readiness.published ? "Published" : "Not set up"}
          </p>
          {readiness.published && readiness.attributedReviews30d > 0 && (
            <p className="mt-1 text-xs text-[#137333]">
              {readiness.attributedReviews30d} review
              {readiness.attributedReviews30d === 1 ? "" : "s"} attributed (30d)
            </p>
          )}
          <Link
            href={profileGuideHref}
            className="mt-2 inline-flex text-xs font-semibold text-[#1a73e8] hover:underline"
          >
            {readiness.published ? "View guide →" : "Set up →"}
          </Link>
        </div>

        <div className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-3">
          <p className="text-xs font-medium text-[#80868b]">Review velocity</p>
          {reviewGap ? (
            <>
              <p className="mt-1 text-sm font-semibold text-[#202124]">
                {reviewGap.gap} behind on &ldquo;{reviewGap.keyword}&rdquo;
              </p>
              {onNavigateToPlan ? (
                <button
                  type="button"
                  onClick={() => onNavigateToPlan(10)}
                  className="mt-2 text-xs font-semibold text-[#1a73e8] hover:underline"
                >
                  Request reviews →
                </button>
              ) : (
                <p className="mt-2 text-xs text-[#5f6368]">Open Plan → step 10</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-[#137333]">On pace with pack leaders</p>
          )}
        </div>

        <div className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-3">
          <p className="text-xs font-medium text-[#80868b]">Review responses</p>
          <p className="mt-1 text-sm font-semibold text-[#202124]">{responseRate}% response rate</p>
          {responseRate < 100 && onNavigateToPlan ? (
            <button
              type="button"
              onClick={() => onNavigateToPlan(11)}
              className="mt-2 text-xs font-semibold text-[#1a73e8] hover:underline"
            >
              Reply to reviews →
            </button>
          ) : responseRate >= 100 ? (
            <p className="mt-2 text-xs text-[#137333]">Healthy coverage</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
