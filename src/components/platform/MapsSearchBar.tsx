"use client";

import { useEffect, useRef, useState } from "react";
import type { KeywordRankSnapshot } from "@/audit/types";
import { keywordVisibilityLabel } from "@/audit/geo/keyword-visibility-label";

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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#80868b] sm:inline">
            Keyword
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 truncate text-left"
            aria-haspopup="listbox"
            aria-expanded={open}
            title="Switch which keyword the map ranks for"
          >
            <svg
              className="h-4 w-4 shrink-0 text-[#1a73e8] sm:hidden"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </svg>
            <span className="truncate text-sm text-[#202124]">{display}</span>
          </button>
        </div>
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
          aria-label="Ranking keywords"
          className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-[#dadce0] bg-white py-1 shadow-lg"
        >
          <li className="border-b border-[#e8eaed] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#80868b]">
            Switch ranking keyword
          </li>
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
                  <span className="flex shrink-0 items-center gap-1.5">
                    {kw.observationSource === "carried_forward" && (
                      <span
                        className="rounded-full bg-[#fef7e0] px-2 py-0.5 text-[10px] font-medium text-[#b06000]"
                        title="Using the last observed rank until the next scheduled check"
                      >
                        Estimated
                      </span>
                    )}
                    <RankBadge keyword={kw} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RankBadge({ keyword }: { keyword: KeywordRankSnapshot }) {
  const label = keywordVisibilityLabel(keyword);
  const toneClass =
    label.tone === "good"
      ? "bg-[#e6f4ea] text-[#188038]"
      : label.tone === "warning"
        ? "bg-[#fef7e0] text-[#b06000]"
        : "bg-[#fce8e6] text-[#d93025]";

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}
      title={label.title}
    >
      {label.text}
    </span>
  );
}
