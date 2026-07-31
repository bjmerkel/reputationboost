"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

interface PlatformShellProps {
  searchBar?: React.ReactNode;
  toolbar?: React.ReactNode;
  /** Floating keyword search and refresh controls over the map canvas. */
  showMapOverlay?: boolean;
  children: React.ReactNode;
}

const DEFAULT_PANEL_WIDTH = 408;
const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 720;
const PANEL_WIDTH_STORAGE_KEY = "rb-platform-panel-width";
const PANEL_COLLAPSED_STORAGE_KEY = "rb-platform-panel-collapsed";

function clampPanelWidth(width: number, viewportWidth = MAX_PANEL_WIDTH): number {
  const max = Math.min(MAX_PANEL_WIDTH, Math.round(viewportWidth * 0.62));
  return Math.min(max, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}

function readStoredPanelWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PANEL_WIDTH;
  const stored = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
  if (!stored) return DEFAULT_PANEL_WIDTH;
  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) return DEFAULT_PANEL_WIDTH;
  return clampPanelWidth(parsed, window.innerWidth);
}

function useWideLayout(): boolean {
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isWide;
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

  const isWideLayout = useWideLayout();
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelWidthRef = useRef(panelWidth);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setPanelWidth(readStoredPanelWidth());
    setCollapsed(window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY) === "1");
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidth));
    window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  }, [panelWidth, collapsed]);

  const finishDrag = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      const dragState = dragStateRef.current;
      if (!dragState || !isWideLayout || collapsed) return;

      const nextWidth = clampPanelWidth(
        dragState.startWidth + (clientX - dragState.startX),
        window.innerWidth
      );
      setPanelWidth(nextWidth);
    },
    [collapsed, isWideLayout]
  );

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      handlePointerMove(event.clientX);
    }

    function onMouseUp() {
      if (!dragStateRef.current) return;
      finishDrag();
    }

    function onTouchMove(event: TouchEvent) {
      if (!dragStateRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      handlePointerMove(touch.clientX);
    }

    function onTouchEnd() {
      if (!dragStateRef.current) return;
      finishDrag();
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [finishDrag, handlePointerMove]);

  const startDrag = useCallback(
    (clientX: number) => {
      if (!isWideLayout || collapsed) return;
      dragStateRef.current = { startX: clientX, startWidth: panelWidthRef.current };
      setIsDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [collapsed, isWideLayout]
  );

  const resetPanelWidth = useCallback(() => {
    setPanelWidth(DEFAULT_PANEL_WIDTH);
  }, []);

  const panelStyle =
    isWideLayout
      ? {
          width: collapsed ? 0 : panelWidth,
          transition: isDragging ? "none" : "width 220ms ease",
        }
      : undefined;

  return (
    <div className="google-maps-shell flex h-full min-h-0 flex-1 flex-col-reverse overflow-hidden lg:flex-row">
      <div
        className={`relative flex min-h-0 flex-col overflow-hidden border-[#dadce0] bg-white lg:h-full lg:flex-none lg:shrink-0 lg:border-r ${
          isWideLayout ? "" : "flex-[11]"
        } ${collapsed && isWideLayout ? "pointer-events-none border-r-0" : ""}`}
        style={panelStyle}
        aria-hidden={collapsed && isWideLayout}
      >
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            collapsed && isWideLayout ? "opacity-0" : "opacity-100"
          }`}
        >
          {panel}
        </div>

        {isWideLayout && !collapsed && (
          <div
            className="absolute -right-2 top-0 z-30 flex h-full w-4 items-center justify-center"
            onMouseDown={(event) => {
              event.preventDefault();
              startDrag(event.clientX);
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              startDrag(touch.clientX);
            }}
            onDoubleClick={resetPanelWidth}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuenow={panelWidth}
            aria-valuemin={MIN_PANEL_WIDTH}
            aria-valuemax={MAX_PANEL_WIDTH}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setPanelWidth((current) => clampPanelWidth(current - 16, window.innerWidth));
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                setPanelWidth((current) => clampPanelWidth(current + 16, window.innerWidth));
              }
              if (event.key === "Home") {
                event.preventDefault();
                resetPanelWidth();
              }
            }}
          >
            <div
              className={`h-16 w-1 rounded-full transition-colors ${
                isDragging ? "bg-[#1a73e8]" : "bg-[#dadce0] hover:bg-[#1a73e8]/70"
              }`}
            />
            <button
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onClick={() => setCollapsed(true)}
              className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#dadce0] bg-white text-[#5f6368] shadow-sm transition hover:border-[#1a73e8] hover:text-[#1a73e8]"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-[9] flex-col overflow-hidden lg:h-full lg:min-h-[280px] lg:flex-1">
        {isWideLayout && collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="absolute left-3 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#dadce0] bg-white text-[#5f6368] shadow-md transition hover:border-[#1a73e8] hover:text-[#1a73e8]"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

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
