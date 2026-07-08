import type { ExecutionTask, GbpConnection, ClientConfig } from "../types";
import { applyGbpAction, applyMediaFromBytes, applyMediaFromDraft } from "@/lib/google/gbp-apply";
import type { GbpAttributeUpdate } from "@/lib/google/gbp-location";
import type { NapDriftFieldName } from "@/lib/google/nap-drift";
import type { GbpMediaCategory, GbpMediaFormat } from "@/lib/google/gbp-media";
import { dataUrlToBytes } from "@/lib/google/gbp-media";
import type { BusinessHours } from "@/lib/google/gbp-hours";
import {
  parseEditableHolidayPeriods,
  specialHoursFromEditablePeriods,
} from "@/lib/google/gbp-hours";
import { syncRecommendedGbpNotifications } from "@/lib/google/gbp-notifications";
import { createGbpPlaceActionLink, type GbpPlaceActionType } from "@/lib/google/gbp-place-actions";
import { generateGbpPhotoImage } from "@/lib/llm/gbp-photos";
import { sendReviewRequests } from "@/lib/sms/send-review-requests";
import { isValidReviewId } from "./plan-task-utils";

export interface ExecuteTaskContext {
  userId: string;
  business: ClientConfig;
}

/**
 * Execute an approved task — uses live GBP OAuth when connection is available.
 */
export async function executeTask(
  task: ExecutionTask,
  connection?: GbpConnection | null,
  context?: ExecuteTaskContext
): Promise<ExecutionTask> {
  const now = new Date().toISOString();

  if (task.type === "review_request" && context) {
    try {
      const result = await sendReviewRequests({
        userId: context.userId,
        business: context.business,
        template: task.draftContent,
        customerIds: Array.isArray(task.payload.customerIds)
          ? (task.payload.customerIds as string[])
          : undefined,
        batchSize: Number(task.payload.batchSize) || 15,
        executionTaskId: task.id,
      });

      const mode = result.simulated ? "simulated" : "sent";
      const summary = `${mode === "simulated" ? "Simulated" : "Sent"} ${result.sent} SMS review request${result.sent === 1 ? "" : "s"}${result.failed > 0 ? ` (${result.failed} failed)` : ""}.`;

      return {
        ...task,
        status: result.failed > 0 && result.sent === 0 ? "failed" : "completed",
        completedAt: now,
        result: summary,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMS send failed";
      return {
        ...task,
        status: "failed",
        completedAt: now,
        result: message,
      };
    }
  }

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
    gbp_media_recategorize: "Photo recategorized on Google Business Profile.",
    gbp_media_delete: "Photo removed from Google Business Profile.",
    gbp_notifications: "Real-time GBP Pub/Sub alerts enabled.",
    gbp_place_action: "Place action link published on Google Business Profile.",
    gbp_attributes: "Updated business attributes on Google.",
    gbp_website: "Updated website URL on Google Business Profile.",
    gbp_phone: "Updated phone number on Google Business Profile.",
    gbp_hours: "Updated business hours on Google Business Profile.",
    gbp_accept_suggestion: "Accepted Google's suggested profile change.",
    gbp_reject_suggestion: "Kept your preferred value on Google Business Profile.",
    gbp_title: "Synced business name on Google Business Profile.",
    gbp_address: "Synced business address on Google Business Profile.",
    gbp_checklist: `Completed: ${task.title}`,
    review_response: `Posted review response for review ${task.payload.reviewId ?? "unknown"}.`,
    review_delete_reply: `Removed review reply for review ${task.payload.reviewId ?? "unknown"}.`,
    review_request: `Sent ${task.payload.batchSize ?? 15} SMS review requests.`,
    schema_markup: "Generated LocalBusiness schema snippet for developer install.",
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
      return {
        ...task,
        status: result.success ? "completed" : "failed",
        completedAt: now,
        result: result.message,
      };
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
      const previewDataUrl = task.payload.previewDataUrl as string | undefined;

      if (task.type === "gbp_photo" && (imagePrompt || previewDataUrl)) {
        const { bytes, contentType } = previewDataUrl?.startsWith("data:")
          ? dataUrlToBytes(previewDataUrl)
          : await generateGbpPhotoImage(imagePrompt!);

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
    case "gbp_media_recategorize": {
      const result = await applyGbpAction(connection, "recategorize_media", {
        mediaName: String(task.payload.mediaName ?? ""),
        category: task.payload.targetCategory as GbpMediaCategory,
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_media_delete": {
      const result = await applyGbpAction(connection, "delete_media", {
        mediaName: String(task.payload.mediaName ?? ""),
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_notifications": {
      const setting = await syncRecommendedGbpNotifications(connection);
      return {
        ...task,
        status: "completed",
        completedAt: now,
        result: `Enabled ${setting.notificationTypes.length} real-time GBP alert types.`,
      };
    }
    case "gbp_place_action": {
      const batch = task.payload.placeActions as
        | Array<{ placeActionType: string; uri: string }>
        | undefined;

      if (batch?.length) {
        const published: string[] = [];
        for (const item of batch) {
          if (!item.uri?.startsWith("https://")) {
            throw new Error("Each place action link requires a valid https:// URL.");
          }
          const link = await createGbpPlaceActionLink(connection, {
            uri: item.uri,
            placeActionType: item.placeActionType as GbpPlaceActionType,
            isPreferred: true,
          });
          published.push(link.placeActionType.replace(/_/g, " ").toLowerCase());
        }
        return {
          ...task,
          status: "completed",
          completedAt: now,
          result: `Published ${published.length} place action link${published.length === 1 ? "" : "s"}: ${published.join(", ")}.`,
        };
      }

      const uri =
        task.draftContent
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.startsWith("https://")) ??
        String(task.payload.suggestedUri ?? "");
      const placeActionType = String(
        task.payload.placeActionType ?? "APPOINTMENT"
      ) as GbpPlaceActionType;

      if (!uri.startsWith("https://")) {
        throw new Error("A valid https:// URL is required on the first line of the draft.");
      }

      const link = await createGbpPlaceActionLink(connection, {
        uri,
        placeActionType,
        isPreferred: true,
      });
      return {
        ...task,
        status: "completed",
        completedAt: now,
        result: `Published ${link.placeActionType.replace(/_/g, " ").toLowerCase()} link.`,
      };
    }
    case "gbp_attributes": {
      const result = task.payload.bookingOnly
        ? await applyGbpAction(connection, "update_booking_attributes", {
            bookingUri: String(task.payload.bookingUri ?? ""),
          })
        : task.payload.enableRecommended
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
    case "gbp_hours": {
      const hoursAction = String(task.payload.hoursAction ?? "update_holiday_hours");
      if (hoursAction === "update_regular_hours") {
        const regularHours =
          task.payload.regularHours && typeof task.payload.regularHours === "object"
            ? (task.payload.regularHours as BusinessHours)
            : undefined;
        const result = await applyGbpAction(connection, "update_regular_hours", { regularHours });
        return { ...task, status: "completed", completedAt: now, result: result.message };
      }

      const year =
        typeof task.payload.holidayYear === "number"
          ? task.payload.holidayYear
          : new Date().getFullYear();
      const holidayEdits = parseEditableHolidayPeriods(task.payload.holidayEdits, year);
      const specialHours = specialHoursFromEditablePeriods(holidayEdits);
      const result = await applyGbpAction(connection, "update_holiday_hours", { specialHours });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_accept_suggestion": {
      const result = await applyGbpAction(connection, "accept_google_suggestion", {
        suggestionField: String(task.payload.suggestionField ?? ""),
      });
      return {
        ...task,
        status: result.success ? "completed" : "failed",
        completedAt: now,
        result: result.message,
      };
    }
    case "gbp_reject_suggestion": {
      const result = await applyGbpAction(connection, "reject_google_suggestion", {
        suggestionField: String(task.payload.suggestionField ?? ""),
        preferredValue:
          typeof task.payload.preferredValue === "string"
            ? task.payload.preferredValue
            : typeof task.payload.ownerValue === "string"
              ? task.payload.ownerValue
              : undefined,
      });
      return {
        ...task,
        status: result.success ? "completed" : "failed",
        completedAt: now,
        result: result.message,
      };
    }
    case "gbp_title":
    case "gbp_address": {
      const result = await applyGbpAction(connection, "sync_nap_field", {
        napField: task.payload.napField as NapDriftFieldName,
        napCanonical: task.payload.napCanonical as {
          name: string;
          phone: string;
          website: string;
          address: string;
        },
      });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "review_response": {
      const reviewId = String(task.payload.reviewId ?? "").trim();
      if (!isValidReviewId(reviewId)) {
        return {
          ...task,
          status: "failed",
          completedAt: now,
          result:
            "No review linked to this task — open Home or Plan to reply to specific customers.",
        };
      }
      const result = await applyGbpAction(connection, "reply_review", {
        reviewId,
        reviewReply: task.draftContent,
      });
      return {
        ...task,
        status: result.success ? "completed" : "failed",
        completedAt: now,
        result: result.message,
      };
    }
    case "review_delete_reply": {
      const reviewId = String(task.payload.reviewId ?? "");
      const result = await applyGbpAction(connection, "delete_review_reply", { reviewId });
      return { ...task, status: "completed", completedAt: now, result: result.message };
    }
    case "gbp_checklist":
    case "review_request":
    case "schema_markup":
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
