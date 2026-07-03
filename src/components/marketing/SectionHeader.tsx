import type { ReactNode } from "react";

type LabelColor = "emerald" | "cyan" | "violet" | "amber" | "rose";

const labelColorClass: Record<LabelColor, string> = {
  emerald: "text-emerald-400",
  cyan: "text-cyan-400",
  violet: "text-violet-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
};

export default function SectionHeader({
  label,
  labelColor = "emerald",
  title,
  subtitle,
  className = "",
}: {
  label: string;
  labelColor?: LabelColor;
  title: ReactNode;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-3xl text-center ${className}`}>
      <span
        className={`text-sm font-semibold uppercase tracking-widest ${labelColorClass[labelColor]}`}
      >
        {label}
      </span>
      <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg text-slate-400">{subtitle}</p>}
    </div>
  );
}
