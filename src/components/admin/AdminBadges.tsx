import type { HealthGrade } from "@/audit/types";
import type { UserStatus } from "@/lib/admin/types";
import { gradeLabel } from "@/lib/scores/grade";

export function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function statusLabel(status: UserStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "at_risk":
      return "At risk";
    case "churning":
      return "Churning";
    case "never_onboarded":
      return "Not onboarded";
    case "signed_up":
      return "Signed up";
  }
}

export function statusClass(status: UserStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "at_risk":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "churning":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "never_onboarded":
      return "bg-slate-500/15 text-slate-300 border-slate-500/30";
    case "signed_up":
      return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}

export function gradeClass(grade: HealthGrade | null): string {
  if (grade === "healthy") return "text-emerald-400";
  if (grade === "urgent") return "text-red-400";
  if (grade === "at_risk") return "text-amber-400";
  return "text-slate-400";
}

export function GradeBadge({ grade }: { grade: HealthGrade | null }) {
  if (!grade) {
    return <span className="text-sm text-slate-500">—</span>;
  }
  return <span className={`text-sm font-medium ${gradeClass(grade)}`}>{gradeLabel(grade)}</span>;
}

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "danger"
          ? "text-red-400"
          : "text-white";

  return (
    <div className="rounded-xl border border-[#2d3348] bg-[#151923] p-5">
      <p className="text-sm font-medium text-[#94a3b8]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#64748b]">{hint}</p> : null}
    </div>
  );
}

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-slate-500">—</span>;
  if (delta > 0) {
    return <span className="font-medium text-emerald-400">+{delta}</span>;
  }
  if (delta < 0) {
    return <span className="font-medium text-red-400">{delta}</span>;
  }
  return <span className="text-slate-400">0</span>;
}
