import type { ExecutionTask } from "@/audit/types";
import { pendingBatchTasks } from "./pending-tasks";

export interface PendingApprovalCounts {
  /** All tasks awaiting approval, including photos still generating. */
  total: number;
  /** Tasks ready to step through in batch review. */
  batchable: number;
  /** Photo tasks pending approval but missing a preview. */
  generating: number;
  /** Review-reply drafts awaiting approval. */
  reviewReplies: number;
}

export function getPendingApprovalCounts(tasks: ExecutionTask[]): PendingApprovalCounts {
  const all = tasks.filter((t) => t.status === "pending_approval");
  const batchable = pendingBatchTasks(tasks);
  return {
    total: all.length,
    batchable: batchable.length,
    generating: all.length - batchable.length,
    reviewReplies: all.filter((t) => t.type === "review_response").length,
  };
}

/** Count shown on the Plan tab badge and primary approval CTAs. */
export function planApprovalBadgeCount(tasks: ExecutionTask[]): number {
  const { batchable, generating } = getPendingApprovalCounts(tasks);
  return batchable > 0 ? batchable : generating;
}
