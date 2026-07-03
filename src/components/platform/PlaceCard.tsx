"use client";

import type { FullAuditPayload } from "@/audit/types";
import type { AuditView } from "@/components/audit/types";
import ExternalImage from "@/components/ExternalImage";
import { PLACE_CARD_TABS } from "@/components/platform/types";
import ActionMetricsBar from "@/components/platform/ActionMetricsBar";
import PlaceCardDetails from "@/components/platform/PlaceCardDetails";

interface PlaceCardProps {
  audit: FullAuditPayload;
  activeView: AuditView;
  onViewChange: (view: AuditView) => void;
  pendingTasks?: number;
  pendingPhotoTasks?: number;
  children: React.ReactNode;
}

export default function PlaceCard({
  audit,
  activeView,
  onViewChange,
  pendingTasks = 0,
  pendingPhotoTasks = 0,
  children,
}: PlaceCardProps) {
  const { gbp } = audit;
  const heroPhoto = gbp.content.mediaPreviews?.[0]?.thumbnailUrl;
  const rating = gbp.engagement.averageRating;
  const reviewCount = gbp.engagement.reviewCount;
  const category = gbp.identity.primaryCategory || gbp.liveProfile?.primaryCategory;

  return (
    <aside className="flex h-full w-full flex-col border-[#dadce0] bg-white lg:w-[400px] lg:shrink-0 lg:border-r">
      {heroPhoto && (
        <div className="relative h-36 w-full shrink-0 overflow-hidden bg-[#e8eaed]">
          <ExternalImage
            src={heroPhoto}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="shrink-0 border-b border-[#dadce0] px-4 py-4">
        <h1 className="text-xl font-normal leading-snug text-[#202124]">
          {gbp.identity.name || audit.clientName}
        </h1>

        {(rating > 0 || reviewCount > 0) && (
          <div className="mt-1 flex items-center gap-1.5 text-sm">
            <span className="font-medium text-[#202124]">{rating.toFixed(1)}</span>
            <StarRating rating={rating} />
            <span className="text-[#5f6368]">({reviewCount})</span>
          </div>
        )}

        {category && (
          <p className="mt-1 text-sm text-[#5f6368]">{category}</p>
        )}

        <div className="mt-4">
          <ActionMetricsBar audit={audit} />
        </div>
      </div>

      <PlaceCardDetails audit={audit} />

      <nav
        aria-label="Business sections"
        className="flex shrink-0 gap-0 overflow-x-auto border-b border-[#dadce0] px-2"
      >
        {PLACE_CARD_TABS.map((tab) => {
          const isActive = activeView === tab.id;
          const badge =
            tab.id === "execute"
              ? pendingTasks
              : tab.id === "photos"
                ? pendingPhotoTasks
                : 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onViewChange(tab.id)}
              className={`relative shrink-0 px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "text-[#007b83] after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-[#007b83]"
                  : "text-[#5f6368] hover:text-[#3c4043]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.mapsLabel}
                {badge > 0 && (
                  <span className="rounded-full bg-[#fce8e6] px-1.5 py-0.5 text-[10px] font-bold text-[#d93025]">
                    {badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="maps-panel-light min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {children}
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
