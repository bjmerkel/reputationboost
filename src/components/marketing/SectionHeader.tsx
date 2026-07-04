import type { ReactNode } from "react";

type LabelColor = "emerald" | "cyan" | "violet" | "amber" | "rose";

const labelColorClass: Record<LabelColor, string> = {
  emerald: "text-[#188038]",
  cyan: "text-[#1a73e8]",
  violet: "text-[#9334e6]",
  amber: "text-[#e37400]",
  rose: "text-[#d93025]",
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
        className={`text-xs font-semibold uppercase tracking-wider ${labelColorClass[labelColor]}`}
      >
        {label}
      </span>
      <h2 className="mt-3 text-3xl font-normal tracking-tight text-[#202124] sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-[#5f6368]">{subtitle}</p>}
    </div>
  );
}
