import { randomUUID } from "crypto";
import type {
  ActionItem,
  ExecutionTask,
  FullAuditPayload,
  Phase3ExecutionReport,
} from "../types";
import type { AuditGeneratedContent } from "@/lib/llm/content";
import { buildTemplateContent } from "@/lib/llm/content";
import { mapActionToExecutionType } from "./content";

function requiresApproval(type: ExecutionTask["type"]): boolean {
  return ["google_post", "review_response", "social_post", "gbp_description"].includes(type);
}

function buildTask(
  audit: FullAuditPayload,
  action: ActionItem,
  type: ExecutionTask["type"],
  draftContent: string,
  payload: Record<string, unknown> = {}
): ExecutionTask {
  const needsApproval = requiresApproval(type);
  return {
    id: randomUUID(),
    auditId: audit.auditId,
    actionItemId: action.id,
    type,
    title: action.title,
    description: action.description,
    priority: action.priority,
    status: needsApproval ? "pending_approval" : "approved",
    draftContent,
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
  return posts.map((content, i) =>
    buildTask(audit, action, "google_post", content, {
      postIndex: i + 1,
      totalPosts: posts.length,
      platform: "google_business",
    })
  );
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
  return responses.map((r) =>
    buildTask(audit, action, "review_response", r.response, {
      reviewId: r.reviewId,
      rating: r.rating,
    })
  );
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
          { photoCount: 5 }
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
        }),
      ];
    default:
      return [
        buildTask(audit, action, type, action.draftCopy ?? action.description, {}),
      ];
  }
}

export function generateExecutionQueue(
  audit: FullAuditPayload,
  content?: AuditGeneratedContent
): Phase3ExecutionReport {
  const resolvedContent = content ?? buildTemplateContent(audit);
  const tasks: ExecutionTask[] = [];

  for (const action of audit.strategy.actionPlan) {
    tasks.push(...createTaskForAction(audit, action, resolvedContent));
  }

  const pendingApproval = tasks.filter((t) => t.status === "pending_approval").length;
  const autoApproved = tasks.filter((t) => t.status === "approved").length;

  return {
    generatedAt: new Date().toISOString(),
    tasksCreated: tasks.length,
    pendingApproval,
    autoApproved,
    tasks,
    contentSource: resolvedContent.contentSource,
  };
}
