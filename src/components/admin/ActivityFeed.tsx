import Link from "next/link";
import { formatRelativeDate } from "@/components/admin/AdminBadges";
import { formatAuditAction, type AdminAuditLogEntry } from "@/lib/admin/audit-log";

function activityHref(entry: AdminAuditLogEntry): string | null {
  if (entry.targetType === "user" && entry.targetId) {
    return `/admin/users/${entry.targetId}`;
  }
  if (entry.targetType === "task" && entry.targetId && entry.targetId !== "bulk") {
    return `/admin/tasks?status=pending_approval`;
  }
  if (entry.targetType === "business" && entry.targetId) {
    return `/admin/businesses/${entry.targetId}`;
  }
  if (entry.action.includes("audit_log")) {
    return "/admin/audit-log";
  }
  return null;
}

function activityDetail(entry: AdminAuditLogEntry): string {
  const actor = entry.adminEmail ?? "System";
  const target = entry.targetId ? `${entry.targetType ?? "item"} ${entry.targetId}` : "";
  if (entry.action === "bulk_approve_tasks") {
    const approved = entry.metadata.approved;
    return `${actor} approved ${approved ?? "multiple"} tasks`;
  }
  if (entry.action === "playbook_step") {
    const label = entry.metadata.stepLabel ?? entry.metadata.stepId;
    return `${actor} completed playbook step: ${label}`;
  }
  if (entry.action === "force_approve_task") {
    return `${actor} force-approved a task`;
  }
  if (entry.action === "create_note") {
    return `${actor} added a note`;
  }
  if (entry.action.startsWith("start_manage") || entry.action === "start_manage_as_user") {
    return `${actor} started managing as user`;
  }
  if (target) {
    return `${actor} — ${formatAuditAction(entry.action)} (${target})`;
  }
  return `${actor} — ${formatAuditAction(entry.action)}`;
}

export default function ActivityFeed({ entries }: { entries: AdminAuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-[#64748b]">No admin activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const href = activityHref(entry);
        const content = (
          <div className="rounded-lg border border-[#2d3348] bg-[#1a1f2e] px-4 py-3">
            <p className="text-sm text-[#e2e8f0]">{activityDetail(entry)}</p>
            <p className="mt-1 text-xs text-[#64748b]">{formatRelativeDate(entry.createdAt)}</p>
          </div>
        );

        return (
          <li key={entry.id}>
            {href ? (
              <Link href={href} className="block transition-opacity hover:opacity-90">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
