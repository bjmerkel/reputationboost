import { randomUUID } from "crypto";
import type {
  ActionPriority,
  ExecutionTask,
  FullAuditPayload,
  GbpPlanStep,
} from "../types";
import type { AuditGeneratedContent } from "@/lib/llm/content";
import { normalizeTextContent } from "@/lib/llm/normalize-content";

function stepPriority(stepNumber: number): ActionPriority {
  if (stepNumber <= 3) return "P0";
  if (stepNumber <= 11) return "P1";
  return "P2";
}

function requiresApproval(type: ExecutionTask["type"]): boolean {
  return [
    "google_post",
    "review_response",
    "gbp_description",
    "gbp_primary_category",
    "gbp_secondary_categories",
    "gbp_services",
    "gbp_attributes",
    "gbp_website",
    "gbp_phone",
  ].includes(type);
}

function buildGbpTask(
  audit: FullAuditPayload,
  step: GbpPlanStep,
  type: ExecutionTask["type"],
  title: string,
  draftContent: string,
  payload: Record<string, unknown> = {}
): ExecutionTask {
  const content = normalizeTextContent(draftContent);
  const needsApproval = requiresApproval(type);
  return {
    id: randomUUID(),
    auditId: audit.auditId,
    actionItemId: `gbp-step-${step.stepNumber}`,
    type,
    title: `Step ${step.stepNumber}: ${title}`,
    description: step.instruction,
    priority: stepPriority(step.stepNumber),
    status: needsApproval ? "pending_approval" : "approved",
    draftContent: content,
    payload: { gbpStepNumber: step.stepNumber, gbpStepTitle: step.title, ...payload },
    requiresApproval: needsApproval,
    scheduledFor: needsApproval ? null : new Date().toISOString(),
    completedAt: null,
    result: null,
    createdAt: new Date().toISOString(),
  };
}

function reviewPayload(
  audit: FullAuditPayload,
  reviewId: string,
  rating: number
): Record<string, unknown> {
  const review = audit.reviews.reviews.find((r) => r.id === reviewId);
  return {
    reviewId,
    rating,
    reviewAuthor: review?.author,
    reviewText: review?.text,
  };
}

function checklistContent(step: GbpPlanStep): string {
  const parts = [step.instruction];
  if (step.recommended) parts.push(`Recommended: ${step.recommended}`);
  if (step.bullets?.length) {
    parts.push("", "Checklist:", ...step.bullets.map((b) => `• ${b}`));
  }
  return parts.join("\n");
}

export function tasksFromGbpPlanStep(
  audit: FullAuditPayload,
  step: GbpPlanStep,
  content: AuditGeneratedContent
): ExecutionTask[] {
  const data = step.actionData ?? {};

  switch (step.gbpAction) {
    case "update_primary_category":
      return [
        buildGbpTask(
          audit,
          step,
          "gbp_primary_category",
          step.title,
          data.primaryCategory ?? step.recommended ?? step.title,
          { primaryCategory: data.primaryCategory ?? step.recommended }
        ),
      ];
    case "add_secondary_categories":
      return [
        buildGbpTask(
          audit,
          step,
          "gbp_secondary_categories",
          step.title,
          (data.secondaryCategories ?? step.bullets ?? []).join("\n"),
          { secondaryCategories: data.secondaryCategories ?? step.bullets }
        ),
      ];
    case "update_description":
      return [
        buildGbpTask(
          audit,
          step,
          "gbp_description",
          step.title,
          data.description ??
            step.copyBlocks?.[0]?.content ??
            content.gbpDescription,
          { field: "description" }
        ),
      ];
    case "add_service_items": {
      const blocks = step.copyBlocks ?? [];
      if (blocks.length > 0) {
        return blocks.map((block, i) =>
          buildGbpTask(audit, step, "gbp_services", block.label, block.content, {
            serviceIndex: i + 1,
            serviceName: block.label.replace(/^Service #\d+:\s*/i, ""),
            serviceDescription: block.content,
          })
        );
      }
      return [
        buildGbpTask(audit, step, "gbp_checklist", step.title, checklistContent(step), {
          manual: true,
        }),
      ];
    }
    case "update_attributes":
      return [
        buildGbpTask(
          audit,
          step,
          "gbp_attributes",
          step.title,
          step.instruction,
          { enableRecommended: true }
        ),
      ];
    case "update_website": {
      const website = data.websiteUri ?? audit.gbp.identity.website ?? "";
      if (!website) {
        return [
          buildGbpTask(audit, step, "gbp_checklist", step.title, checklistContent(step), {
            manual: true,
          }),
        ];
      }
      return [
        buildGbpTask(audit, step, "gbp_website", step.title, website, {
          websiteUri: website,
        }),
      ];
    }
    case "create_post": {
      const posts = content.googlePosts.length
        ? content.googlePosts
        : [data.postSummary ?? step.copyBlocks?.[0]?.content ?? step.instruction];
      return posts.map((post, i) =>
        buildGbpTask(audit, step, "google_post", `${step.title} (${i + 1}/${posts.length})`, post, {
          postIndex: i + 1,
          totalPosts: posts.length,
          platform: "google_business",
        })
      );
    }
    default:
      break;
  }

  if (step.stepNumber === 9) {
    const qaBlocks = step.copyBlocks ?? [];
    if (qaBlocks.length > 0) {
      return qaBlocks.map((block, i) =>
        buildGbpTask(
          audit,
          step,
          "qa_answer",
          `${block.label}`,
          `${block.label}\n\n${block.content}`,
          { qaIndex: i + 1 }
        )
      );
    }
    return [
      buildGbpTask(audit, step, "qa_answer", step.title, content.qaAnswer, { qaTemplate: true }),
    ];
  }

  if (step.stepNumber === 10) {
    return [
      buildGbpTask(audit, step, "review_request", step.title, content.reviewRequestSms, {
        channel: "sms",
        batchSize: 15,
      }),
    ];
  }

  if (step.stepNumber === 11) {
    const responses = content.reviewResponses;
    if (responses.length > 0) {
      return responses.map((r) => {
        const review = audit.reviews.reviews.find((rev) => rev.id === r.reviewId);
        const author = review?.author?.split(" ")[0] ?? "customer";
        return buildGbpTask(
          audit,
          step,
          "review_response",
          `Respond to ${author} (${r.rating}★)`,
          r.response,
          reviewPayload(audit, r.reviewId, r.rating)
        );
      });
    }
    const template =
      step.copyBlocks?.[0]?.content ?? "Respond to all reviews within 24 hours.";
    return [buildGbpTask(audit, step, "review_response", step.title, template, { reviewId: null })];
  }

  if (step.stepNumber === 5) {
    const blocks = step.copyBlocks ?? [];
    if (blocks.length > 0) {
      return blocks.map((block, i) =>
        buildGbpTask(audit, step, "gbp_services", block.label, block.content, {
          serviceIndex: i + 1,
        })
      );
    }
  }

  if (step.copyBlocks?.length) {
    return step.copyBlocks.map((block, i) =>
      buildGbpTask(audit, step, "gbp_checklist", block.label, block.content, {
        checklistIndex: i + 1,
      })
    );
  }

  return [
    buildGbpTask(audit, step, "gbp_checklist", step.title, checklistContent(step), {
      manual: true,
    }),
  ];
}

export function tasksFromGbpPlan(
  audit: FullAuditPayload,
  content: AuditGeneratedContent
): ExecutionTask[] {
  const plan = audit.strategy.gbpPlan;
  if (!plan) return [];

  const tasks: ExecutionTask[] = [];
  for (const step of plan.steps) {
    tasks.push(...tasksFromGbpPlanStep(audit, step, content));
  }
  return tasks;
}

/** Gap-driven tasks not covered by the 16-step GBP plan (schema, citations, social). */
export const SUPPLEMENTARY_GAP_IDS = new Set([
  "missing-schema",
  "citation-mismatch",
  "low-social",
]);
