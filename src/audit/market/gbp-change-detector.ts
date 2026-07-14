import type { ExecutionType } from "@/audit/types";

const RANK_SIGNAL_TASK_TYPES = new Set<ExecutionType>([
  "gbp_description",
  "gbp_primary_category",
  "gbp_secondary_categories",
  "gbp_services",
  "gbp_title",
  "gbp_phone",
  "gbp_website",
  "gbp_address",
  "gbp_attributes",
  "gbp_hours",
  "update_tracked_keywords",
]);

export function taskCanAffectLocalRank(type: ExecutionType): boolean {
  return RANK_SIGNAL_TASK_TYPES.has(type);
}
