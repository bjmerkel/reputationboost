import type { ExecutionTask, FullAuditPayload } from "@/audit/types";

/** Merge pending drafts into a customer-facing preview. */
export function getOptimizedPreview(audit: FullAuditPayload, tasks: ExecutionTask[]) {
  const descriptionTask = tasks.find(
    (t) => t.type === "gbp_description" && t.status === "pending_approval"
  );
  const postTask = tasks.find(
    (t) => t.type === "google_post" && t.status === "pending_approval"
  );

  return {
    description:
      descriptionTask?.draftContent?.trim() ||
      audit.gbp.liveProfile?.description ||
      "",
    recentPost: postTask?.draftContent?.trim() || audit.gbp.recentPosts?.[0]?.summary || "",
  };
}
