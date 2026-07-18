"use client";

import Link from "next/link";

export default function PlanAcvNudge({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const isLight = variant === "light";

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        isLight
          ? "border-[#dadce0] bg-[#f8f9fa] text-[#3c4043]"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      <p className={`font-medium ${isLight ? "text-[#202124]" : "text-white"}`}>
        Add your average job value to unlock revenue estimates
      </p>
      <p className={`mt-1 text-xs ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Plan steps will show estimated $/mo from more calls and directions once average
        customer value is set.
      </p>
      <Link
        href="/platform/settings"
        className={`mt-2 inline-flex text-xs font-semibold ${
          isLight ? "text-[#1a73e8] hover:underline" : "text-sky-300 hover:underline"
        }`}
      >
        Set average job value in Settings →
      </Link>
    </div>
  );
}
