"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ScoreTooltipContent } from "@/lib/scores/score-tooltips";

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
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const isLight = variant === "light";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node)) {
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

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border p-3 text-left shadow-lg ${
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
      )}
    </span>
  );
}
