"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { BusinessSummary } from "@/lib/business/active-business-shared";
import { withBusinessId } from "@/lib/business/active-business-shared";

interface BusinessSwitcherProps {
  businesses: BusinessSummary[];
  activeBusinessId: string;
}

export default function BusinessSwitcher({
  businesses,
  activeBusinessId,
}: BusinessSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const active =
    businesses.find((business) => business.id === activeBusinessId) ?? businesses[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!active || businesses.length === 0) return null;

  function buildHref(businessId: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("businessId", businessId);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  if (businesses.length === 1) {
    return (
      <div className="hidden min-w-0 sm:block">
        <Link
          href="/platform/locations"
          className="block max-w-[220px] truncate text-sm font-medium text-[#202124] hover:text-[#1a73e8] lg:max-w-[280px]"
          title={active.name}
        >
          {active.name}
        </Link>
        {(active.city || active.state) && (
          <p className="max-w-[220px] truncate text-xs text-[#80868b] lg:max-w-[280px]">
            {[active.city, active.state].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative hidden min-w-0 sm:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex max-w-[220px] items-center gap-2 rounded-lg border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 text-left transition hover:border-[#1a73e8] hover:bg-white lg:max-w-[280px]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[#202124]">{active.name}</span>
          {(active.city || active.state) && (
            <span className="block truncate text-xs text-[#80868b]">
              {[active.city, active.state].filter(Boolean).join(", ")}
            </span>
          )}
        </span>
        <ChevronIcon className="h-4 w-4 shrink-0 text-[#5f6368]" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[#dadce0] bg-white shadow-lg"
          role="listbox"
        >
          <div className="border-b border-[#e8eaed] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#80868b]">
              Your locations
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {businesses.map((business) => {
              const isActive = business.id === activeBusinessId;
              return (
                <Link
                  key={business.id}
                  href={buildHref(business.id)}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 transition hover:bg-[#f8f9fa] ${
                    isActive ? "bg-[#e8f0fe]" : ""
                  }`}
                  role="option"
                  aria-selected={isActive}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#202124]">{business.name}</p>
                      <p className="truncate text-xs text-[#80868b]">
                        {[business.city, business.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                    <StatusBadge business={business} />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="border-t border-[#e8eaed] p-2">
            <Link
              href="/platform/locations"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-[#5f6368] transition hover:bg-[#f8f9fa] hover:text-[#202124]"
            >
              View all locations
            </Link>
            <Link
              href={withBusinessId("/platform/onboard?add=1", activeBusinessId)}
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold text-[#1a73e8] transition hover:bg-[#e8f0fe]"
            >
              + Add location
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ business }: { business: BusinessSummary }) {
  if (business.onboardingComplete && business.gbpConnected) {
    return (
      <span className="shrink-0 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#137333]">
        Live
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#b06000]">
      Setup
    </span>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
