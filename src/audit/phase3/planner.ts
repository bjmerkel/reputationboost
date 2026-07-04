import { createId } from "@/lib/create-id";
import type {
  ActionItem,
  ExecutionTask,
  FullAuditPayload,
  Phase3ExecutionReport,
} from "../types";
import type { AuditGeneratedContent } from "@/lib/llm/content";
import { buildTemplateContent } from "@/lib/llm/content";
import { normalizeTextContent } from "@/lib/llm/normalize-content";
import { mapActionToExecutionType } from "./content";
import { SUPPLEMENTARY_GAP_IDS, tasksFromGbpPlan, tasksFromGoogleSuggestions, tasksFromMediaMaintenance, tasksFromNapDrift, tasksFromNotificationGaps, tasksFromVideoGaps } from "./gbp-plan-tasks";
import { matchKeywordsInText } from "@/audit/attribution/keywords";

function requiresApproval(type: ExecutionTask["type"]): boolean {
  return [
    "google_post",
    "review_response",
    "social_post",
    "gbp_description",
    "gbp_primary_category",
    "gbp_secondary_categories",
    "gbp_services",
    "gbp_photo",
    "gbp_video",
    "gbp_attributes",
    "gbp_website",
    "gbp_phone",
    "gbp_hours",
    "gbp_accept_suggestion",
    "gbp_title",
    "gbp_address",
  ].includes(type);
}

function buildTask(
  audit: FullAuditPayload,
  action: ActionItem,
  type: ExecutionTask["type"],
  draftContent: string,
  payload: Record<string, unknown> = {},
  titleOverride?: string
): ExecutionTask {
  const needsApproval = requiresApproval(type);
  const content = normalizeTextContent(draftContent);
  return {
    id: createId(),
    auditId: audit.auditId,
    actionItemId: action.id,
    type,
    title: titleOverride ?? action.title,
    description: action.description,
    priority: action.priority,
    status: needsApproval ? "pending_approval" : "approved",
    draftContent: content,
    payload,
    requiresApproval: needsApproval,
    scheduledFor: needsApproval ? null : new Date().toISOString(),
    completedAt: null,
    result: null,
    createdAt: new Date().toISOString(),
  };
}

function tasksFromGooglePosts(
  audit: FullAuditPayload,
  action: ActionItem,
  posts: string[]
): ExecutionTask[] {
  const keywords = audit.rankings.keywords.map((k) => k.keyword);
  return posts.map((content, i) => {
    const matched = matchKeywordsInText(content, keywords);
    const targetKeywords =
      matched.length > 0 ? matched : keywords[i % keywords.length] ? [keywords[i % keywords.length]] : [];
    return buildTask(audit, action, "google_post", content, {
      postIndex: i + 1,
      totalPosts: posts.length,
      platform: "google_business",
      targetKeywords,
    });
  });
}

function tasksFromReviewResponses(
  audit: FullAuditPayload,
  action: ActionItem,
  responses: AuditGeneratedContent["reviewResponses"]
): ExecutionTask[] {
  if (responses.length === 0) {
    return [
      buildTask(
        audit,
        action,
        "review_response",
        action.draftCopy ?? "No pending reviews to respond to.",
        { reviewId: null }
      ),
    ];
  }
  return responses.map((r) => {
    const review = audit.reviews.reviews.find((rev) => rev.id === r.reviewId);
    const author = review?.author?.split(" ")[0] ?? "customer";
    const isRedraft = review?.replyState === "REJECTED";
    return buildTask(
      audit,
      action,
      "review_response",
      r.response,
      {
        reviewId: r.reviewId,
        rating: r.rating,
        reviewAuthor: review?.author,
        reviewText: review?.text,
        replyState: review?.replyState,
        policyViolation: review?.policyViolation,
        previousReply: isRedraft ? review?.replyText : undefined,
        targetKeywords: matchKeywordsInText(
          `${r.response} ${review?.text ?? ""}`,
          audit.rankings.keywords.map((k) => k.keyword)
        ),
      },
      isRedraft
        ? `Rewrite rejected reply for ${author} (${r.rating}★)`
        : `Respond to ${author} (${r.rating}★)`
    );
  });
}

function createTaskForAction(
  audit: FullAuditPayload,
  action: ActionItem,
  content: AuditGeneratedContent
): ExecutionTask[] {
  const index = audit.strategy.actionPlan.indexOf(action);
  const gapId = audit.strategy.gaps[index]?.id ?? "";
  const type =
    mapActionToExecutionType(gapId) ??
    (action.category === "content"
      ? "google_post"
      : action.category === "reviews"
        ? action.title.includes("unresponded")
          ? "review_response"
          : "review_request"
        : action.category === "gbp_profile"
          ? "gbp_description"
          : action.category === "technical"
            ? "schema_markup"
            : action.category === "social"
              ? "social_post"
              : "gbp_description");

  switch (type) {
    case "google_post":
      return tasksFromGooglePosts(audit, action, content.googlePosts);
    case "review_response":
      return tasksFromReviewResponses(audit, action, content.reviewResponses);
    case "review_request":
      return [
        buildTask(audit, action, "review_request", content.reviewRequestSms, {
          channel: "sms",
          batchSize: 15,
        }),
      ];
    case "gbp_description":
      return [
        buildTask(audit, action, "gbp_description", content.gbpDescription, {
          field: "description",
          targetKeywords: audit.rankings.keywords.map((k) => k.keyword),
        }),
      ];
    case "gbp_services":
      return [
        buildTask(
          audit,
          action,
          "gbp_services",
          `Upload 5 new photos: team at work, completed project, storefront, service vehicle, before/after. Add services: ${audit.rankings.keywords
            .slice(0, 3)
            .map((k) => k.keyword)
            .join(", ")}.`,
          {
            photoCount: 5,
            targetKeywords: audit.rankings.keywords.slice(0, 3).map((k) => k.keyword),
          }
        ),
      ];
    case "gbp_photo":
      return [
        buildTask(
          audit,
          action,
          "gbp_photo",
          [
            "Paste a public image URL on the first line (https://...), then approve to upload.",
            "",
            "Suggested: storefront exterior, team at work, completed projects, fleet/vehicles.",
            "Category: ADDITIONAL",
          ].join("\n"),
          { mediaFormat: "PHOTO", category: "ADDITIONAL" },
          "Upload GBP photos"
        ),
      ];
    case "qa_answer":
      return [
        buildTask(audit, action, "qa_answer", content.qaAnswer, { qaTemplate: true }),
      ];
    case "schema_markup":
      return [
        buildTask(
          audit,
          action,
          "schema_markup",
          `Add LocalBusiness JSON-LD schema to ${audit.gbp.identity.website} with name, address, phone, and geo coordinates.`,
          { url: audit.gbp.identity.website }
        ),
      ];
    case "citation_fix":
      return [
        buildTask(
          audit,
          action,
          "citation_fix",
          `Fix NAP inconsistencies on: ${audit.offGoogle.citations
            .filter((c) => !c.addressMatch || !c.phoneMatch)
            .map((c) => c.source)
            .join(", ")}.`,
          { citations: audit.offGoogle.citations }
        ),
      ];
    case "social_post":
      return [
        buildTask(audit, action, "social_post", content.socialPost || action.draftCopy || "", {
          platforms: ["facebook", "instagram"],
          frequency: "1x_week",
          targetKeywords: matchKeywordsInText(
            content.socialPost || action.draftCopy || "",
            audit.rankings.keywords.map((k) => k.keyword)
          ),
        }),
      ];
    case "gbp_hours":
      return [
        buildTask(
          audit,
          action,
          "gbp_hours",
          action.draftCopy ?? action.description,
          {
            hoursAction: action.id.includes("holiday")
              ? "update_holiday_hours"
              : "update_regular_hours",
          }
        ),
      ];
    case "gbp_accept_suggestion":
      return [
        buildTask(
          audit,
          action,
          "gbp_accept_suggestion",
          action.draftCopy ?? action.description,
          {}
        ),
      ];
    case "gbp_media_recategorize":
    case "gbp_media_delete":
    case "gbp_notifications":
      return [];
    case "gbp_attributes":
      return [
        buildTask(audit, action, "gbp_attributes", action.draftCopy ?? action.description, {
          enableRecommended: true,
        }),
      ];
    case "gbp_title":
    case "gbp_address":
    case "gbp_phone":
    case "gbp_website":
      return [
        buildTask(audit, action, type, action.draftCopy ?? action.description, {}),
      ];
    default:
      return [
        buildTask(audit, action, type, action.draftCopy ?? action.description, {}),
      ];
  }
}

function dedupeExecutionTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  const seenPhoto = new Set<string>();
  const seenVideo = new Set<string>();

  return tasks.filter((task) => {
    if (task.type === "gbp_photo") {
      const category = String(task.payload.category ?? "");
      if (category && seenPhoto.has(category)) return false;
      if (category) seenPhoto.add(category);
    }
    if (task.type === "gbp_video") {
      const key = task.title.replace(/^Step \d+: /, "");
      if (seenVideo.has(key)) return false;
      seenVideo.add(key);
    }
    return true;
  });
}

export function generateExecutionQueue(
  audit: FullAuditPayload,
  content?: AuditGeneratedContent
): Phase3ExecutionReport {
  const resolvedContent = content ?? buildTemplateContent(audit);
  const tasks = dedupeExecutionTasks([
    ...tasksFromGbpPlan(audit, resolvedContent),
    ...tasksFromGoogleSuggestions(audit),
    ...tasksFromMediaMaintenance(audit),
    ...tasksFromVideoGaps(audit),
    ...tasksFromNotificationGaps(audit),
    ...tasksFromNapDrift(audit),
  ]);

  for (const action of audit.strategy.actionPlan) {
    const index = audit.strategy.actionPlan.indexOf(action);
    const gapId = audit.strategy.gaps[index]?.id ?? "";
    if (!SUPPLEMENTARY_GAP_IDS.has(gapId)) continue;
    tasks.push(...createTaskForAction(audit, action, resolvedContent));
  }

  const dedupedTasks = dedupeExecutionTasks(tasks);

  const pendingApproval = dedupedTasks.filter((t) => t.status === "pending_approval").length;
  const autoApproved = dedupedTasks.filter((t) => t.status === "approved").length;

  return {
    generatedAt: new Date().toISOString(),
    tasksCreated: dedupedTasks.length,
    pendingApproval,
    autoApproved,
    tasks: dedupedTasks,
    contentSource: resolvedContent.contentSource,
  };
}
