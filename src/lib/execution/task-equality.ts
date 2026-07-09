import type { ExecutionTask } from "@/audit/types";

/** Cheap equality for task lists — avoids re-render/refetch loops when data is unchanged. */
export function executionTasksEqual(a: ExecutionTask[], b: ExecutionTask[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((task, index) => {
    const other = b[index];
    if (!other) return false;
    return (
      task.id === other.id &&
      task.status === other.status &&
      task.completedAt === other.completedAt &&
      task.draftContent === other.draftContent &&
      task.result === other.result
    );
  });
}
