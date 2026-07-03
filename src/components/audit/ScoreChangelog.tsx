"use client";

import type { ScoreChangelogEntry } from "@/audit/types";

export default function ScoreChangelog({
  entries,
  title = "Recent changes",
  compact = false,
}: {
  entries: ScoreChangelogEntry[];
  title?: string;
  compact?: boolean;
}) {
  if (entries.length === 0) return null;

  return (
    <section className={compact ? "space-y-1.5" : "space-y-2"}>
      <p
        className={`font-semibold uppercase tracking-wider text-[#80868b] ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        {title}
      </p>
      <ul className="space-y-1.5">
        {entries.map((entry, i) => (
          <li
            key={`${entry.label}-${i}`}
            className={`flex items-start gap-2 rounded-lg bg-[#f8f9fa] px-2.5 py-2 ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            <span
              className={`shrink-0 font-bold ${
                entry.delta > 0 ? "text-[#137333]" : entry.delta < 0 ? "text-[#d93025]" : "text-[#5f6368]"
              }`}
            >
              {entry.delta > 0 ? "+" : ""}
              {entry.delta}
            </span>
            <span className="text-[#3c4043]">{entry.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
