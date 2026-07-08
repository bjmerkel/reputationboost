"use client";

import Link from "next/link";
import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import ExternalImage from "@/components/ExternalImage";

interface HomeReviewInboxProps {
  audit: FullAuditPayload;
  pendingReplyCount?: number;
  onReviewPending?: () => void;
  onNavigateToPlan?: () => void;
}

export default function HomeReviewInbox({
  audit,
  pendingReplyCount = 0,
  onReviewPending,
  onNavigateToPlan,
}: HomeReviewInboxProps) {
  const { reviews } = audit;
  const urgent = selectUrgentReviews(reviews.reviews, 3);
  const needsAction =
    reviews.unrespondedNegative > 0 ||
    pendingReplyCount > 0 ||
    reviews.rejectedReplies > 0;

  if (reviews.reviews.length === 0) {
    return (
      <section className="min-w-0 overflow-hidden rounded-xl border border-[#dadce0] bg-white p-4 shadow-sm">
        <InboxHeader />
        <p className="mt-3 text-sm text-[#5f6368]">
          No reviews collected yet. Re-run audit after connecting GBP.
        </p>
      </section>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#dadce0] bg-white p-4 shadow-sm">
      <InboxHeader />

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Unresponded"
          value={String(reviews.unrespondedNegative)}
          warn={reviews.unrespondedNegative > 0}
        />
        <Stat
          label="Avg response"
          value={formatResponseTime(reviews.avgResponseTimeHours)}
        />
        <Stat label="Pending replies" value={String(reviews.pendingReplies)} />
        <Stat label="Total reviews" value={String(reviews.reviews.length)} />
      </div>

      {needsAction ? (
        <div className="mt-3 space-y-2">
          {pendingReplyCount > 0 && onReviewPending && (
            <button
              type="button"
              onClick={onReviewPending}
              className="w-full rounded-lg border border-[#fdd663] bg-[#fef7e0] px-4 py-3 text-left text-sm leading-relaxed text-[#3c4043] hover:bg-[#fef0c7]"
            >
              <span className="font-medium">{pendingReplyCount} review repl{pendingReplyCount === 1 ? "y" : "ies"}</span>{" "}
              waiting for approval — review now →
            </button>
          )}

          {pendingReplyCount === 0 && reviews.unrespondedNegative > 0 && onNavigateToPlan && (
            <button
              type="button"
              onClick={onNavigateToPlan}
              className="w-full rounded-lg border border-[#fdd663] bg-[#fef7e0] px-4 py-3 text-left text-sm leading-relaxed text-[#3c4043] hover:bg-[#fef0c7]"
            >
              <span className="font-medium">{reviews.unrespondedNegative} negative review{reviews.unrespondedNegative === 1 ? "" : "s"}</span>{" "}
              need replies — open Plan →
            </button>
          )}

          {reviews.rejectedReplies > 0 && onNavigateToPlan && (
            <button
              type="button"
              onClick={onNavigateToPlan}
              className="w-full rounded-lg border border-[#fce8e6] bg-[#fef7f6] px-4 py-2.5 text-left text-sm leading-relaxed text-[#c5221f] hover:bg-[#fce8e6]"
            >
              {reviews.rejectedReplies} repl{reviews.rejectedReplies === 1 ? "y was" : "ies were"} rejected by Google — fix in Plan →
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#137333]">All caught up on review replies.</p>
      )}

      {urgent.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[#80868b]">
            {needsAction ? "Needs attention" : "Recent reviews"}
          </p>
          {urgent.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </div>
      )}

      {reviews.sentiment.negativeThemes.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[#80868b]">
            Top complaints
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reviews.sentiment.negativeThemes.slice(0, 4).map((theme) => (
              <span
                key={theme}
                className="rounded-full bg-[#fce8e6] px-2 py-0.5 text-xs text-[#c5221f]"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e8eaed] pt-3 text-xs">
        <button
          type="button"
          onClick={() => onNavigateToPlan?.()}
          className="font-medium text-[#1a73e8] hover:underline"
        >
          View in Plan →
        </button>
        <Link href="/platform/customers" className="font-medium text-[#1a73e8] hover:underline">
          Request more reviews →
        </Link>
      </div>
    </section>
  );
}

function InboxHeader() {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#80868b]">
        Review inbox
      </p>
      <p className="mt-1 break-words text-sm leading-relaxed text-[#5f6368]">
        Urgent reviews and reply queue — approve drafts from Home or Plan.
      </p>
    </div>
  );
}

function formatResponseTime(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function selectUrgentReviews(reviews: ReviewRecord[], limit: number): ReviewRecord[] {
  const unrespondedNegative = reviews.filter((r) => r.rating <= 3 && !r.responded);
  const unrespondedOther = reviews.filter((r) => r.rating > 3 && !r.responded);
  const responded = reviews.filter((r) => r.responded);
  return [...unrespondedNegative, ...unrespondedOther, ...responded].slice(0, limit);
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2">
      <p className="truncate text-[10px] uppercase tracking-wide text-[#80868b]">{label}</p>
      <p
        className={`truncate text-lg font-semibold tabular-nums ${
          warn && value !== "0" && value !== "—" ? "text-[#d93025]" : "text-[#202124]"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function ReviewRow({ review }: { review: ReviewRecord }) {
  const sentimentCls =
    review.sentiment === "positive"
      ? "text-[#137333]"
      : review.sentiment === "negative"
        ? "text-[#c5221f]"
        : "text-[#e37400]";

  return (
    <article className="rounded-lg border border-[#e8eaed] bg-[#f8f9fa] p-3">
      <div className="flex items-start gap-3">
        {review.authorPhotoUrl ? (
          <ExternalImage
            src={review.authorPhotoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8eaed] text-xs text-[#5f6368]">
            {review.author.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[#202124]">{review.author}</span>
            <span className="text-xs text-[#fbbc04]">{review.rating}★</span>
            <span className={`text-[10px] font-medium uppercase ${sentimentCls}`}>
              {review.sentiment}
            </span>
            {review.responded ? (
              <span className="text-[10px] text-[#137333]">Replied</span>
            ) : (
              <span className="text-[10px] font-medium text-[#d93025]">Needs reply</span>
            )}
          </div>
          {review.text && (
            <p className="mt-1 line-clamp-2 text-sm text-[#3c4043]">{review.text}</p>
          )}
        </div>
      </div>
    </article>
  );
}
