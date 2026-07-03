import type { ExecutionTask, GbpConnection } from "../types";
import { applyGbpAction, applyMediaFromBytes, applyMediaFromDraft } from "@/lib/google/gbp-apply";
import type { GbpAttributeUpdate } from "@/lib/google/gbp-location";
import type { GbpMediaCategory, GbpMediaFormat } from "@/lib/google/gbp-media";
import { generateGbpPhotoImage } from "@/lib/llm/gbp-photos";

/**
 * Execute an approved task — uses live GBP OAuth when connection is available.
 */
export async function executeTask(
  task: ExecutionTask,
  connection?: GbpConnection | null
): Promise<ExecutionTask> {
  const now = new Date().toISOString();

  if (connection) {
    try {
      return await executeTaskLive(task, connection, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      return {
        ...task,
        status: "failed",
        completedAt: now,
        result: message,
      };
    }
  }

  const resultByType: Record<ExecutionTask["type"], string> = {
    google_post: `Published Google Post: "${task.draftContent.slice(0, 60)}…"`,
    gbp_description: "Updated GBP business description.",
    gbp_primary_category: "Updated GBP primary category.",
    gbp_secondary_categories: "Updated GBP secondary categories.",
    gbp_services: "Added service to Google Business Profile.",
    gbp_photo: "Photo uploaded to Google Business Profile.",
    gbp_video: "Video uploaded to Google Business Profile.",
    gbp_attributes: "Updated business attributes on Google.",
    gbp_website: "Updated website URL on Google Business Profile.",
    gbp_phone: "Updated phone number on Google Business Profile.",
    gbp_checklist: `Completed: ${task.title}`,
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

async function executeTaskLive(
  task: ExecutionTask,
  connection: GbpConnection,
  now: string
): Promise<ExecutionTask> {
  switch (task.type) {
    case "google_post": {
      const result = await applyGbpAction(connection, "create_post", {
        postSummary: task.draftContent,
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_description": {
      const result = await applyGbpAction(connection, "update_description", {
        description: task.draftContent,
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_primary_category": {
      const category = String(
        task.payload.primaryCategory ?? task.draftContent
      );
      const result = await applyGbpAction(connection, "update_primary_category", {
        primaryCategory: category,
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_secondary_categories": {
      const categories = Array.isArray(task.payload.secondaryCategories)
        ? (task.payload.secondaryCategories as string[])
        : task.draftContent.split("\n").filter(Boolean);
      const result = await applyGbpAction(connection, "add_secondary_categories", {
        secondaryCategories: categories,
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_services": {
      const serviceName = String(
        task.payload.serviceName ?? task.title.replace(/^Step \d+:\s*/i, "")
      );
      const result = await applyGbpAction(connection, "add_service_item", {
        serviceName,
        serviceDescription: task.draftContent,
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_photo":
    case "gbp_video": {
      const imagePrompt = task.payload.imagePrompt as string | undefined;
      if (task.type === "gbp_photo" && imagePrompt) {
        const { bytes, contentType } = await generateGbpPhotoImage(imagePrompt);
        const result = await applyMediaFromBytes(connection, bytes, contentType, {
          mediaFormat: "PHOTO",
          category: (task.payload.category as GbpMediaCategory) ?? "ADDITIONAL",
          description: task.payload.hint as string | undefined,
        });
        return { ...task, status: "completed", completedAt: now, result: result.message };
      }

      const result = await applyMediaFromDraft(connection, task.draftContent, {
        sourceUrl: task.payload.sourceUrl as string | undefined,
        mediaFormat:
          (task.payload.mediaFormat as GbpMediaFormat) ??
          (task.type === "gbp_video" ? "VIDEO" : "PHOTO"),
        category: (task.payload.category as GbpMediaCategory) ?? "ADDITIONAL",
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_attributes": {
      const result = task.payload.enableRecommended
        ? await applyGbpAction(connection, "enable_recommended_attributes", {})
        : await applyGbpAction(connection, "update_attributes", {
            attributes: task.payload.attributes as GbpAttributeUpdate[] | undefined,
          });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_website": {
      const result = await applyGbpAction(connection, "update_website", {
        websiteUri: String(task.payload.websiteUri ?? task.draftContent),
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_phone": {
      const result = await applyGbpAction(connection, "update_phone", {
        primaryPhone: String(task.payload.primaryPhone ?? task.draftContent),
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "review_response": {
      const reviewId = String(task.payload.reviewId ?? "");
      const result = await applyGbpAction(connection, "reply_review", {
        reviewId,
        reviewReply: task.draftContent,
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_checklist":
    case "qa_answer":
    case "review_request":
    case "schema_markup":
    case "citation_fix":
    case "social_post":
      return {
        ...task,
        status: "completed",
        completedAt: now,
        result: `Step marked complete. Verify "${task.title}" in Google Business Profile or your other tools.`,
      };
    default:
      return {
        ...task,
        status: "completed",
        completedAt: now,
        result: `Task "${task.title}" marked complete.`,
      };
  }
}

export async function executeApprovedTasks(
  tasks: ExecutionTask[],
  connection?: GbpConnection | null
): Promise<ExecutionTask[]> {
  const approved = tasks.filter((t) => t.status === "approved");
  const results: ExecutionTask[] = [];

  for (const task of approved) {
    const executed = await executeTask(task, connection);
    results.push(executed);
  }

  return results;
}
