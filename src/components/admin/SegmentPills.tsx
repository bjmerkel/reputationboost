import Link from "next/link";
import { ADMIN_SEGMENTS, countUsersInSegment } from "@/lib/admin/segments";
import type { AdminUserSummary } from "@/lib/admin/types";

export default function SegmentPills({
  users,
  activeSegment,
}: {
  users: AdminUserSummary[];
  activeSegment?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <SegmentPill href="/admin/users" label="All users" count={users.length} active={!activeSegment || activeSegment === "all"} />
      {ADMIN_SEGMENTS.map((segment) => (
        <SegmentPill
          key={segment.id}
          href={`/admin/users?segment=${segment.id}`}
          label={segment.label}
          count={countUsersInSegment(users, segment.id)}
          active={activeSegment === segment.id}
        />
      ))}
    </div>
  );
}

function SegmentPill({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-[#6366f1] bg-[#6366f1]/20 text-white"
          : "border-[#334155] bg-[#1e2433] text-[#94a3b8] hover:border-[#475569] hover:text-white"
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-xs ${active ? "bg-[#6366f1]/30" : "bg-[#0f1117]"}`}>
        {count}
      </span>
    </Link>
  );
}
