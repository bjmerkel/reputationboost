"use client";

export function hasMaintenanceCadence(
  weeklyCadence: string[],
  monthlyCadence: string[]
): boolean {
  return weeklyCadence.length > 0 || monthlyCadence.length > 0;
}

export default function PlanMaintenanceCadence({
  weeklyCadence,
  monthlyCadence,
  variant = "light",
}: {
  weeklyCadence: string[];
  monthlyCadence: string[];
  variant?: "light" | "dark";
}) {
  if (!hasMaintenanceCadence(weeklyCadence, monthlyCadence)) return null;

  const isLight = variant === "light";
  const showWeekly = weeklyCadence.length > 0;
  const showMonthly = monthlyCadence.length > 0;

  return (
    <section
      className={`rounded-xl border p-5 ${
        isLight ? "border-[#dadce0] bg-white" : "border-white/10 bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isLight ? "text-[#80868b]" : "text-slate-500"
        }`}
      >
        Stay on track
      </p>
      <p className={`mt-1 text-sm ${isLight ? "text-[#5f6368]" : "text-slate-400"}`}>
        Ongoing cadence after you finish the steps above — no approvals required.
      </p>

      <div className={`mt-4 grid gap-4 ${showWeekly && showMonthly ? "sm:grid-cols-2" : ""}`}>
        {showWeekly && <CadenceList title="Weekly" items={weeklyCadence} isLight={isLight} />}
        {showMonthly && <CadenceList title="Monthly" items={monthlyCadence} isLight={isLight} />}
      </div>
    </section>
  );
}

function CadenceList({
  title,
  items,
  isLight,
}: {
  title: string;
  items: string[];
  isLight: boolean;
}) {
  return (
    <div>
      <p className={`text-sm font-semibold ${isLight ? "text-[#202124]" : "text-white"}`}>
        {title}
      </p>
      <ul
        className={`mt-2 list-disc space-y-1 pl-5 text-sm ${
          isLight ? "text-[#3c4043]" : "text-slate-300"
        }`}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
