import type { ExecutionTask } from "../types";

/**
 * Simulates executing an approved task.
 * Wire to GBP API, review API, etc. when credentials are available.
 */
export async function executeTask(task: ExecutionTask): Promise<ExecutionTask> {
  const now = new Date().toISOString();

  if (process.env.GOOGLE_BUSINESS_API_KEY) {
    return executeTaskLive(task);
  }

  const resultByType: Record<ExecutionTask["type"], string> = {
    google_post: `Published Google Post: "${task.draftContent.slice(0, 60)}…"`,
    gbp_description: "Updated GBP business description.",
    gbp_services: "Queued photo upload and service list update.",
    review_response: `Posted review response for review ${task.payload.reviewId ?? "unknown"}.`,
    review_request: `Sent ${task.payload.batchSize ?? 15} SMS review requests.`,
    qa_answer: "Published Q&A answer on Google Business Profile.",
    schema_markup: "Generated LocalBusiness schema snippet for developer install.",
    citation_fix: "Submitted citation corrections to directories.",
    social_post: "Scheduled Facebook and Instagram post.",
  };

  return {
    ...task,
    status: "completed",
    completedAt: now,
    result: resultByType[task.type] ?? "Task executed successfully.",
  };
}

async function executeTaskLive(task: ExecutionTask): Promise<ExecutionTask> {
  void task;
  throw new Error(
    "Live GBP execution pending. Implement executeTaskLive with Google Business Profile API."
  );
}

export async function executeApprovedTasks(
  tasks: ExecutionTask[]
): Promise<ExecutionTask[]> {
  const approved = tasks.filter((t) => t.status === "approved");
  const results: ExecutionTask[] = [];

  for (const task of approved) {
    const executed = await executeTask(task);
    results.push(executed);
  }

  return results;
}
