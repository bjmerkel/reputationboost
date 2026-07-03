"use client";

import type { FullAuditPayload, ReviewRecord } from "@/audit/types";
import ExternalImage from "@/components/ExternalImage";

interface PlaceCardReviewsPanelProps {
  audit: FullAuditPayload;
  onOpenUpdates?: () => void;
  unrespondedCount?: number;
}

export default function PlaceCardReviewsPanel({
  audit,
  onOpenUpdates,
  unrespondedCount = 0,
}: PlaceCardReviewsPanelProps) {
  const { reviews } = audit;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Unresponded" value={String(reviews.unrespondedNegative)} warn />
        <Stat
          label="Avg response"
          value={
            reviews.avgResponseTimeHours != null
              ? `${reviews.avgResponseTimeHours}h`
              : "—"
          }
        />
        <Stat label="Pending replies" value={String(reviews.pendingReplies)} />
        <Stat label="Total reviews" value={String(reviews.reviews.length)} />
      </div>

      {unrespondedCount > 0 && onOpenUpdates && (
        <button
          type="button"
          onClick={onOpenUpdates}
          className="w-full rounded-lg border border-[#fdd663] bg-[#fef7e0] px-4 py-3 text-left text-sm text-[#3c4043] hover:bg-[#fef0c7]"
        >
          <span className="font-medium">{unrespondedCount} review replies</span> waiting for
          approval in Updates →
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ThemeTags title="Praise themes" items={reviews.sentiment.positiveThemes} tone="positive" />
        <ThemeTags title="Complaint themes" items={reviews.sentiment.negativeThemes} tone="negative" />
      </div>

      <div className="space-y-3">
        {reviews.reviews.slice(0, 12).map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
        {reviews.reviews.length === 0 && (
          <p className="text-sm text-[#5f6368]">
            No reviews collected yet. Re-run audit after connecting GBP.
          </p>
        )}
      </div>
    </div>
  );
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
    <div className="rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#80868b]">{label}</p>
      <p
        className={`text-lg font-semibold ${
          warn && value !== "0" ? "text-[#d93025]" : "text-[#202124]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ThemeTags({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  const cls =
    tone === "positive"
      ? "bg-[#e6f4ea] text-[#137333]"
      : "bg-[#fce8e6] text-[#c5221f]";

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#80868b]">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-[#80868b]">—</span>
        ) : (
          items.map((item) => (
            <span key={item} className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>
              {item}
            </span>
          ))
        )}
      </div>
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
    <article className="rounded-lg border border-[#dadce0] bg-white p-3">
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
            {review.responded && (
              <span className="text-[10px] text-[#137333]">Replied</span>
            )}
          </div>
          {review.text && (
            <p className="mt-1 line-clamp-3 text-sm text-[#3c4043]">{review.text}</p>
          )}
        </div>
      </div>
    </article>
  );
}
