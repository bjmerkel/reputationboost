"use client";

import type { FullAuditPayload } from "@/audit/types";

interface ActionMetricsBarProps {
  audit: FullAuditPayload;
}

interface MetricItem {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
}

export default function ActionMetricsBar({ audit }: ActionMetricsBarProps) {
  const { performance } = audit.gbp;
  const { strategy } = audit;

  const engagement = strategy?.monthlyReport?.engagement;
  const formatDelta = (change: number | undefined) => {
    if (change === undefined || change === 0) return null;
    const positive = change > 0;
    return (
      <span className={`text-[10px] font-medium ${positive ? "text-[#188038]" : "text-[#d93025]"}`}>
        {positive ? "+" : ""}
        {change}
      </span>
    );
  };

  const metrics: MetricItem[] = [
    {
      id: "calls",
      label: "Calls",
      value: String(performance.calls ?? 0),
      icon: <PhoneIcon />,
    },
    {
      id: "directions",
      label: "Directions",
      value: String(performance.directionRequests ?? 0),
      icon: <DirectionsIcon />,
    },
    {
      id: "website",
      label: "Website",
      value: String(performance.websiteClicks ?? 0),
      icon: <WebsiteIcon />,
    },
    {
      id: "views",
      label: "Profile views",
      value: String(performance.profileViews ?? 0),
      icon: <ViewsIcon />,
    },
    {
      id: "search",
      label: "Search",
      value: String(performance.impressionsSearch ?? 0),
      icon: <SearchIcon />,
    },
  ];

  const deltas: Record<string, number | undefined> = {
    calls: engagement?.calls.change,
    directions: engagement?.directions.change,
    website: engagement?.websiteClicks.change,
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {metrics.map((m) => (
        <div
          key={m.id}
          className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#007b83] text-white shadow-sm">
            {m.icon}
          </div>
          <span className="text-center text-[10px] font-medium text-[#3c4043]">{m.label}</span>
          <span className="text-center text-xs font-semibold text-[#202124]">{m.value}</span>
          {deltas[m.id] !== undefined && (
            <span className="text-center">{formatDelta(deltas[m.id])}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.07 21 3 13.93 3 5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z" />
    </svg>
  );
}

function DirectionsIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.97.633-3.794 1.716-5.282" />
    </svg>
  );
}

function ViewsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}
