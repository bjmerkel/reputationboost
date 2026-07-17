"use client";

import type { ExecutionTask, FullAuditPayload, GbpMediaPreview } from "@/audit/types";
import { resolveDisplayCategory } from "@/lib/business/display-category";
import ExternalImage from "@/components/ExternalImage";
import { getOptimizedPreview } from "@/lib/execution/listing-preview";
import {
  formatCustomerAttribution,
  selectPreferredHeroPreview,
} from "@/lib/google/gbp-media-display";
import { formatStarRating } from "@/lib/format-star-rating";

interface ViewAsCustomerModalProps {
  audit: FullAuditPayload;
  tasks: ExecutionTask[];
  industry?: string;
  open: boolean;
  onClose: () => void;
}

export default function ViewAsCustomerModal({
  audit,
  tasks,
  industry,
  open,
  onClose,
}: ViewAsCustomerModalProps) {
  if (!open) return null;

  const { gbp } = audit;
  const preview = getOptimizedPreview(audit, tasks);
  const heroPreview = selectPreferredHeroPreview(gbp.content.mediaPreviews);
  const heroPhoto = heroPreview?.thumbnailUrl;
  const mediaPreviews = gbp.content.mediaPreviews ?? [];
  const rating = gbp.engagement.averageRating;
  const reviewCount = gbp.engagement.reviewCount;
  const category = resolveDisplayCategory(audit, industry);
  const hasOptimizations = tasks.some((t) => t.status === "pending_approval");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-preview-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full flex-col border-[#dadce0] lg:w-[380px] lg:border-r">
          <div className="flex items-center justify-between border-b border-[#dadce0] px-4 py-3">
            <h2 id="customer-preview-title" className="text-sm font-medium text-[#202124]">
              What customers see today
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <CustomerPlaceCard
            label="Live on Google Maps"
            gbp={gbp}
            heroPhoto={heroPhoto}
            heroPreview={heroPreview}
            mediaPreviews={mediaPreviews}
            rating={rating}
            reviewCount={reviewCount}
            category={category}
            description={gbp.liveProfile?.description || ""}
            recentPost={gbp.recentPosts?.[0]?.summary}
          />
        </div>

        <div className="flex w-full flex-col bg-[#f8f9fa] lg:flex-1">
          <div className="border-b border-[#dadce0] px-4 py-3">
            <h2 className="text-sm font-medium text-[#202124]">
              After approved optimizations
              {hasOptimizations && (
                <span className="ml-2 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-medium text-[#137333]">
                  Preview
                </span>
              )}
            </h2>
          </div>
          <CustomerPlaceCard
            label={hasOptimizations ? "Optimized preview" : "Same as today"}
            gbp={gbp}
            heroPhoto={heroPhoto}
            heroPreview={heroPreview}
            mediaPreviews={mediaPreviews}
            rating={rating}
            reviewCount={reviewCount}
            category={category}
            description={preview.description}
            recentPost={preview.recentPost}
            optimized
          />
        </div>
      </div>
    </div>
  );
}

function CustomerPlaceCard({
  label,
  gbp,
  heroPhoto,
  heroPreview,
  mediaPreviews = [],
  rating,
  reviewCount,
  category,
  description,
  recentPost,
  optimized = false,
}: {
  label: string;
  gbp: FullAuditPayload["gbp"];
  heroPhoto?: string;
  heroPreview?: GbpMediaPreview;
  mediaPreviews?: GbpMediaPreview[];
  rating: number;
  reviewCount: number;
  category?: string;
  description: string;
  recentPost?: string;
  optimized?: boolean;
}) {
  const photoStrip = mediaPreviews.filter((item) => item.mediaFormat === "PHOTO").slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto">
      {heroPhoto && (
        <div className="relative h-32 overflow-hidden bg-[#e8eaed]">
          <ExternalImage src={heroPhoto} alt="" className="h-full w-full object-cover" />
          {heroPreview?.isCustomerPhoto && (
            <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">
              {formatCustomerAttribution(heroPreview.attributionName)} photo
            </span>
          )}
        </div>
      )}
      <div className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[#80868b]">{label}</p>
        <h3 className="mt-1 text-lg text-[#202124]">{gbp.identity.name}</h3>
        {(rating > 0 || reviewCount > 0) && (
          <p className="mt-1 text-sm text-[#5f6368]">
            {formatStarRating(rating)} ★ ({reviewCount})
          </p>
        )}
        {category && <p className="mt-0.5 text-sm text-[#5f6368]">{category}</p>}

        <div className="mt-4 flex gap-2">
          {["Call", "Directions", "Website"].map((action) => (
            <div key={action} className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#007b83] text-[10px] font-medium text-white">
                {action.charAt(0)}
              </div>
              <span className="text-[10px] text-[#5f6368]">{action}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {gbp.identity.address && (
            <p className="text-[#3c4043]">📍 {gbp.identity.address}</p>
          )}
          <p className="text-[#3c4043]">
            🕐 {gbp.completeness.hasHours ? "Hours listed" : "Hours not listed"}
          </p>
        </div>

        {description && (
          <div className="mt-4">
            <p className="text-xs font-medium text-[#5f6368]">About</p>
            <p
              className={`mt-1 text-sm leading-relaxed ${
                optimized ? "text-[#137333]" : "text-[#3c4043]"
              }`}
            >
              {description}
            </p>
          </div>
        )}

        {recentPost && (
          <div className="mt-4 rounded-lg border border-[#dadce0] bg-white p-3">
            <p className="text-xs font-medium text-[#5f6368]">Latest post</p>
            <p className={`mt-1 text-sm ${optimized ? "text-[#137333]" : "text-[#3c4043]"}`}>
              {recentPost}
            </p>
          </div>
        )}

        {photoStrip.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-[#5f6368]">Photos on profile</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {photoStrip.map((item, index) => (
                <div
                  key={`${item.googleUrl}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-md bg-[#e8eaed]"
                >
                  <ExternalImage
                    src={item.thumbnailUrl}
                    alt={item.description || "Profile photo"}
                    className="h-full w-full object-cover"
                  />
                  {item.isCustomerPhoto && (
                    <span className="absolute bottom-0 left-0 right-0 truncate bg-black/65 px-1 py-0.5 text-[9px] text-white">
                      {formatCustomerAttribution(item.attributionName)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
