"use client";

import type { EngagementPeriodSummary } from "@/audit/engagement-period";
import type { FullAuditPayload } from "@/audit/types";
import type { AuditView } from "@/components/audit/types";
import { resolveDisplayCategory } from "@/lib/business/display-category";
import ExternalImage from "@/components/ExternalImage";
import ActionMetricsBar from "@/components/platform/ActionMetricsBar";
import PlaceCardDetails from "@/components/platform/PlaceCardDetails";
import PlaceCardTabNav from "@/components/platform/PlaceCardTabNav";
import {
  formatCustomerAttribution,
  selectPreferredHeroPreview,
} from "@/lib/google/gbp-media-display";
import { formatStarRating } from "@/lib/format-star-rating";

interface PlaceCardProps {
  audit: FullAuditPayload;
  activeView: AuditView;
  onViewChange: (view: AuditView) => void;
  planPendingCount?: number;
  onPreviewCustomer?: () => void;
  sparklines?: Record<string, number[]>;
  engagement?: EngagementPeriodSummary | null;
  industry?: string;
  /** Hide hero, score breakdown, and metrics when content lives in the main panel. */
  minimalChrome?: boolean;
  scoreCalculatedAt?: string | null;
  children: React.ReactNode;
}

export default function PlaceCard({
  audit,
  activeView,
  onViewChange,
  planPendingCount = 0,
  onPreviewCustomer,
  sparklines,
  engagement,
  industry,
  minimalChrome = false,
  scoreCalculatedAt,
  children,
}: PlaceCardProps) {
  const { gbp } = audit;
  const heroPreview = selectPreferredHeroPreview(gbp.content.mediaPreviews);
  const heroPhoto = heroPreview?.thumbnailUrl;
  const rating = gbp.engagement.averageRating;
  const reviewCount = gbp.engagement.reviewCount;
  const category = resolveDisplayCategory(audit, industry);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        {heroPhoto && !minimalChrome && (
          <div className="relative h-36 w-full shrink-0 overflow-hidden bg-[#e8eaed]">
            <ExternalImage
              src={heroPhoto}
              alt=""
              className="h-full w-full object-cover"
            />
            {heroPreview?.isCustomerPhoto && (
              <span className="absolute left-2 top-2 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">
                {formatCustomerAttribution(heroPreview.attributionName)} photo
              </span>
            )}
          </div>
        )}

        <div className="shrink-0 border-b border-[#dadce0] px-4 py-4">
          <h1 className="text-xl font-normal leading-snug text-[#202124]">
            {gbp.identity.name || audit.clientName}
          </h1>

          {(rating > 0 || reviewCount > 0) && (
            <div className="mt-1 flex items-center gap-1.5 text-sm">
              <span className="font-medium text-[#202124]">{formatStarRating(rating)}</span>
              <StarRating rating={rating} />
              <span className="text-[#5f6368]">({reviewCount})</span>
            </div>
          )}

          {category && (
            <p className="mt-1 text-sm text-[#5f6368]">{category}</p>
          )}

          {!minimalChrome && (
            <div className="mt-4">
              <ActionMetricsBar audit={audit} engagement={engagement} sparklines={sparklines} />
            </div>
          )}
        </div>

        {!minimalChrome && (
          <PlaceCardDetails
            audit={audit}
            onPreviewCustomer={onPreviewCustomer}
            scoreCalculatedAt={scoreCalculatedAt}
          />
        )}

        <PlaceCardTabNav
          activeView={activeView}
          onViewChange={onViewChange}
          planPendingCount={planPendingCount}
        />

        <div className={`maps-panel-light min-w-0 ${minimalChrome ? "px-3 py-4" : "px-4 py-5"}`}>
          {children}
        </div>
      </div>
    </aside>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const partial = rating - full >= 0.5;

  return (
    <span className="inline-flex text-[#fbbc04]" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`h-4 w-4 ${i < full || (i === full && partial) ? "fill-current" : "fill-[#dadce0]"}`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}
