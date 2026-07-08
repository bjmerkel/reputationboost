"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ScoreTooltipContent } from "@/lib/scores/score-tooltips";

const TOOLTIP_WIDTH = 288;
const VIEWPORT_PADDING = 8;
const TOOLTIP_GAP = 8;
const TOOLTIP_Z_INDEX = 10001;

type Placement = "top" | "bottom";

function computeTooltipPosition(
  triggerRect: DOMRect,
  tooltipHeight: number
): { top: number; left: number; placement: Placement } {
  const maxLeft = window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING;
  let left = triggerRect.left + triggerRect.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft));

  const spaceAbove = triggerRect.top - VIEWPORT_PADDING;
  const spaceBelow = window.innerHeight - triggerRect.bottom - VIEWPORT_PADDING;

  const placement: Placement =
    spaceAbove >= tooltipHeight + TOOLTIP_GAP || spaceAbove >= spaceBelow ? "top" : "bottom";

  let top =
    placement === "top"
      ? triggerRect.top - tooltipHeight - TOOLTIP_GAP
      : triggerRect.bottom + TOOLTIP_GAP;

  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, window.innerHeight - tooltipHeight - VIEWPORT_PADDING)
  );

  return { top, left, placement };
}

export default function InfoTooltip({
  title,
  calculation,
  importance,
  variant = "light",
  className = "",
}: ScoreTooltipContent & {
  variant?: "light" | "dark";
  className?: string;
}) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [positioned, setPositioned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: "top" as Placement });
  const isLight = variant === "light";

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  }, [clearCloseTimer]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipHeight = tooltip.offsetHeight;
    setPosition(computeTooltipPosition(triggerRect, tooltipHeight));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPositioned(false);
      return;
    }
    updatePosition();
    setPositioned(true);
  }, [open, updatePosition, title, calculation, importance]);

  useEffect(() => {
    if (!open) return;

    function handleReposition() {
      updatePosition();
    }

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (tooltipRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const tooltipPanel = open ? (
    <div
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: TOOLTIP_WIDTH,
        zIndex: TOOLTIP_Z_INDEX,
        visibility: positioned ? "visible" : "hidden",
      }}
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      className={`rounded-lg border p-3 text-left shadow-lg ${
        isLight
          ? "border-[#dadce0] bg-white text-[#3c4043]"
          : "border-white/10 bg-slate-900 text-slate-300"
      }`}
    >
      <p className={`text-xs font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
        {title}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed">
        <span className={`font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
          How it&apos;s calculated:{" "}
        </span>
        {calculation}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed">
        <span className={`font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
          Why it matters:{" "}
        </span>
        {importance}
      </p>
    </div>
  ) : null;

  return (
    <>
      <span className={`relative inline-flex align-middle ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-describedby={open ? tooltipId : undefined}
          onClick={() => {
            clearCloseTimer();
            setOpen((value) => !value);
          }}
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          onFocus={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onBlur={(event) => {
            if (
              !triggerRef.current?.contains(event.relatedTarget as Node) &&
              !tooltipRef.current?.contains(event.relatedTarget as Node)
            ) {
              setOpen(false);
            }
          }}
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none transition-colors ${
            isLight
              ? "border-[#dadce0] text-[#80868b] hover:border-[#1a73e8] hover:text-[#1a73e8]"
              : "border-white/20 text-slate-500 hover:border-cyan-400 hover:text-cyan-300"
          }`}
        >
          ?
          <span className="sr-only">About {title}</span>
        </button>
      </span>

      {mounted && tooltipPanel ? createPortal(tooltipPanel, document.body) : null}
    </>
  );
}
