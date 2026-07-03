"use client";

import type { AuditView } from "@/components/audit/types";
import { PLACE_CARD_TABS } from "@/components/platform/types";

interface PlaceCardTabNavProps {
  activeView: AuditView;
  onViewChange: (view: AuditView) => void;
  planPendingCount?: number;
}

export default function PlaceCardTabNav({
  activeView,
  onViewChange,
  planPendingCount = 0,
}: PlaceCardTabNavProps) {
  function badgeFor(tabId: AuditView): number {
    if (tabId === "strategy") return planPendingCount;
    return 0;
  }

  return (
    <nav
      aria-label="Business sections"
      className="sticky top-0 z-10 flex shrink-0 gap-0 overflow-x-auto border-b border-[#dadce0] bg-white px-1 scroll-smooth snap-x snap-mandatory sm:px-2"
    >
      {PLACE_CARD_TABS.map((tab) => {
        const isActive = activeView === tab.id;
        const badge = badgeFor(tab.id);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onViewChange(tab.id)}
            className={`relative shrink-0 snap-start px-2.5 py-2.5 text-xs font-medium transition sm:px-4 sm:py-3 sm:text-sm ${
              isActive
                ? "text-[#007b83] after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:rounded-full after:bg-[#007b83] sm:after:left-2 sm:after:right-2"
                : "text-[#5f6368] hover:text-[#3c4043]"
            }`}
          >
            <span className="flex items-center gap-1">
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.mapsLabel}</span>
              {badge > 0 && (
                <span className="rounded-full bg-[#fce8e6] px-1 py-0.5 text-[9px] font-bold text-[#d93025] sm:text-[10px]">
                  {badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
