"use client";

import { Children } from "react";

interface PlatformShellProps {
  searchBar?: React.ReactNode;
  toolbar?: React.ReactNode;
  /** Floating keyword search and refresh controls over the map canvas. */
  showMapOverlay?: boolean;
  children: React.ReactNode;
}

export default function PlatformShell({
  searchBar,
  toolbar,
  showMapOverlay = true,
  children,
}: PlatformShellProps) {
  const childArray = Children.toArray(children);
  const panel = childArray[0];
  const map = childArray[1];

  return (
    <div className="google-maps-shell flex min-h-0 flex-1 flex-col-reverse overflow-hidden lg:flex-row">
      {/* Left place-card panel — matches Google Maps ~408px sidebar */}
      <div className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-[#dadce0] bg-white lg:w-[408px] lg:border-r">
        {panel}
      </div>

      {/* Map canvas with optional floating search overlay */}
      <div className="relative flex h-full min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden">
        {showMapOverlay && (searchBar || toolbar) && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
            {searchBar && (
              <div className="pointer-events-auto min-w-0 flex-1 sm:max-w-md lg:max-w-lg">
                {searchBar}
              </div>
            )}
            {toolbar && <div className="pointer-events-auto shrink-0">{toolbar}</div>}
          </div>
        )}
        <div className="h-full min-h-0 flex-1">{map}</div>
      </div>
    </div>
  );
}
