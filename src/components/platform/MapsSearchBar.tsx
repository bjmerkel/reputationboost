"use client";

import { useEffect, useRef, useState } from "react";
import type { KeywordRankSnapshot } from "@/audit/types";

interface MapsSearchBarProps {
  businessName: string;
  keywords: KeywordRankSnapshot[];
  activeKeyword: string;
  onKeywordChange: (keyword: string) => void;
}

export default function MapsSearchBar({
  businessName,
  keywords,
  activeKeyword,
  onKeywordChange,
}: MapsSearchBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const display =
    activeKeyword || keywords[0]?.keyword || businessName;

  return (
    <div ref={rootRef} className="relative flex-1">
      <div className="flex min-h-[48px] items-center gap-3 rounded-full border border-[#dadce0]/60 bg-white px-4 py-2 shadow-[0_2px_6px_rgba(60,64,67,0.15),0_1px_2px_rgba(60,64,67,0.3)]">
        <svg
          className="h-5 w-5 shrink-0 text-[#5f6368]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 truncate text-left text-sm text-[#202124]"
        >
          {display}
        </button>
        {keywords.length > 1 && (
          <svg
            className={`h-4 w-4 shrink-0 text-[#5f6368] transition ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        )}
      </div>

      {open && keywords.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-[#dadce0] bg-white py-1 shadow-lg"
        >
          {keywords.map((kw) => {
            const isActive = kw.keyword === activeKeyword;

            return (
              <li key={kw.keyword} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => {
                    onKeywordChange(kw.keyword);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#f1f3f4] ${
                    isActive ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#3c4043]"
                  }`}
                >
                  <span className="truncate">{kw.keyword}</span>
                  <RankBadge inPack={kw.inLocalPack} position={kw.localPackPosition} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RankBadge({
  inPack,
  position,
}: {
  inPack: boolean;
  position: number | "not_in_pack";
}) {
  if (inPack && typeof position === "number") {
    return (
      <span className="shrink-0 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-xs font-medium text-[#188038]">
        #{position} in pack
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-[#fce8e6] px-2 py-0.5 text-xs font-medium text-[#d93025]">
      Not in pack
    </span>
  );
}
