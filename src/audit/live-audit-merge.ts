import type { FullAuditPayload } from "@/audit/types";

/** Merge live audit fields into dashboard state without dropping execution tasks. */
export function mergeLiveAuditState(
  current: FullAuditPayload,
  live: FullAuditPayload
): FullAuditPayload {
  return {
    ...live,
    execution: current.execution,
    auditId: current.auditId,
    trigger: current.trigger,
    period: current.period,
    startedAt: current.startedAt,
    completedAt: current.completedAt,
  };
}
