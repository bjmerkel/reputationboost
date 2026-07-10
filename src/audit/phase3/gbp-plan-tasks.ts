import { createId } from "@/lib/create-id";
import type {
  ActionPriority,
  ExecutionTask,
  FullAuditPayload,
  GbpPlanStep,
} from "../types";
import type { AuditGeneratedContent } from "@/lib/llm/content";
import { buildTemplatePhotoJobs, photoJobDraftContent, type GbpPhotoJob } from "@/lib/llm/gbp-photos";
import { buildTemplateVideoJobs, videoJobDraftContent } from "@/lib/llm/gbp-videos";
import { buildCategoryBatchUploadJobs } from "@/lib/google/gbp-media-batch";
import { getGbpPubsubTopic, notificationTypeLabel, type GbpNotificationType } from "@/lib/google/gbp-notifications";
import {
  placeActionTypeLabel,
} from "@/lib/google/gbp-place-actions";
import type { GbpMediaCategory } from "@/lib/google/gbp-media";
import { buildMediaMaintenanceActions } from "@/lib/google/gbp-media-maintenance";
import { mediaCategoryLabel } from "@/lib/google/gbp-media-coverage";
import { formatMediaViewCountLabel } from "@/lib/google/gbp-media-maintenance";
import { normalizeTextContent } from "@/lib/llm/normalize-content";
import { sanitizeGbpDescriptionDraft } from "@/lib/google/gbp-description";
import { sanitizeGbpPostDraft } from "@/lib/google/gbp-post-content";
import { defaultUsHolidayDescriptions } from "@/lib/google/gbp-hours";
import {
  attributeDisplayName,
  buildUserUriAttributeUpdates,
  chunkAttributeUpdates,
  isProfileLinkCoverageItem,
  isUriAttributeType,
  resolveProfileLinkMissing,
} from "@/lib/google/gbp-attribute-recommendations";
import {
  categoryLabelsMatch,
  primaryCategoryUpdateIsNoOp,
  resolveLivePrimaryCategory,
  resolveRecommendedPrimaryCategory,
} from "@/audit/phase2/gbp-category";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";
import { computeKeywordPortfolio, KEYWORD_PORTFOLIO_PLAN_STEP } from "@/audit/phase2/keyword-portfolio";
import { isStepSatisfied } from "@/audit/phase2/counterfactual";
import { generateReviewResponses } from "@/audit/phase3/content";
import { resolvePlanStepAction } from "./gbp-plan-actions";
import { matchKeywordsInText } from "@/audit/attribution/keywords";
import { reviewResponseKeywordFields, optionalReviewResponseKeywordWeave } from "@/lib/review-responses/payload";
import { getPhaseForStep } from "./plan-phases";
import { isCustomPlanStep } from "./plan-custom-steps";
import { buildTaskPayloadContext } from "./step-context";
import {
  isReviewRequestPlanStep,
  isReviewResponsePlanStep,
} from "./gbp-plan-step-intent";

function mediaUploadDraft(hint: string, category: GbpMediaCategory): string {
  return [
    "Paste a public file URL on the first line (must start with https://), then approve to upload.",
    "",
    hint,
    `Category: ${category}`,
  ].join("\n");
}

function stepPriority(stepNumber: number): ActionPriority {
  if (stepNumber <= 3) return "P0";
  if (stepNumber <= 11) return "P1";
  return "P2";
}

function requiresApproval(type: ExecutionTask["type"]): boolean {
  return [
    "google_post",
    "review_response",
    "review_delete_reply",
    "gbp_description",
    "gbp_primary_category",
    "gbp_secondary_categories",
    "gbp_services",
    "gbp_photo",
    "gbp_video",
    "gbp_media_recategorize",
    "gbp_media_delete",
    "gbp_notifications",
    "gbp_attributes",
    "gbp_website",
    "gbp_phone",
    "gbp_hours",
    "gbp_accept_suggestion",
    "gbp_reject_suggestion",
    "gbp_title",
    "gbp_address",
    "update_tracked_keywords",
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
  const phaseId = getPhaseForStep(step.stepNumber);
  const contextPayload = buildTaskPayloadContext(audit, step);
  return {
    id: createId(),
    auditId: audit.auditId,
    actionItemId: `gbp-step-${step.stepNumber}`,
    type,
    title: `Step ${step.stepNumber}: ${title}`,
    description: step.instruction,
    priority: stepPriority(step.stepNumber),
    status: needsApproval ? "pending_approval" : "approved",
    draftContent: content,
    payload: {
      gbpStepNumber: step.stepNumber,
      gbpStepTitle: step.title,
      planPhaseId: phaseId,
      ...(isCustomPlanStep(step.stepNumber) ? { isCustomPlanStep: true } : {}),
      ...contextPayload,
      ...payload,
    },
    requiresApproval: needsApproval,
    scheduledFor: needsApproval ? null : new Date().toISOString(),
    completedAt: null,
    result: null,
    createdAt: new Date().toISOString(),
    planStepNumber: step.stepNumber,
    planPhaseId: phaseId,
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
    replyState: review?.replyState,
    policyViolation: review?.policyViolation,
    previousReply: review?.replyState === "REJECTED" ? review?.replyText : undefined,
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

export function buildAttributeExecutionTasks(
  audit: FullAuditPayload,
  step: GbpPlanStep
): ExecutionTask[] {
  const coverage = audit.gbp.attributeCoverage;
  const payloadUpdates =
    (step.actionData?.attributes as Array<{ name: string; boolValue?: boolean; uri?: string }> | undefined) ??
    coverage?.autoUpdates ??
    [];
  const manualMissing = coverage?.missing.filter((item) => !item.autoApplicable) ?? [];
  const profileLinkMissing = resolveProfileLinkMissing(coverage);
  const enumMissing = manualMissing.filter(
    (item) => !isProfileLinkCoverageItem(item) && !isUriAttributeType(item.valueType)
  );
  const tasks: ExecutionTask[] = [];

  if (payloadUpdates.length > 0) {
    const batches = chunkAttributeUpdates(payloadUpdates);
    for (const [index, batch] of batches.entries()) {
      const labels = batch.map((update) =>
        coverage ? attributeDisplayName(coverage, update.name) : update.name
      );
      const title =
        batches.length > 1
          ? `${step.title} (${index + 1} of ${batches.length})`
          : step.title;

      tasks.push(
        buildGbpTask(
          audit,
          step,
          "gbp_attributes",
          title,
          [
            `Approve to enable ${batch.length} attribute${batch.length === 1 ? "" : "s"} on your Google Business Profile:`,
            ...labels.map((label) => `• ${label}`),
          ].join("\n"),
          { attributes: batch }
        )
      );
    }
  }

  if (profileLinkMissing.length > 0) {
    const uriUpdates = buildUserUriAttributeUpdates(profileLinkMissing, {
      websiteUri: audit.gbp.identity.website,
      phone: audit.gbp.identity.phone,
    });
    const labels = uriUpdates.map((update) =>
      coverage ? attributeDisplayName(coverage, update.name) : update.name
    );

    tasks.push(
      buildGbpTask(
        audit,
        step,
        "gbp_attributes",
        "Add profile links",
        [
          `Add ${uriUpdates.length} link${uriUpdates.length === 1 ? "" : "s"} to your Google Business Profile:`,
          ...labels.map((label) => `• ${label}`),
        ].join("\n"),
        { attributes: uriUpdates, requiresUriInput: true }
      )
    );
  }

  if (enumMissing.length > 0) {
    tasks.push(
      buildGbpTask(
        audit,
        step,
        "gbp_checklist",
        "Set remaining GBP attributes",
        [
          "These attributes must be set manually in Google Business Profile:",
          ...enumMissing.map(
            (item) =>
              `• ${item.displayName}${item.groupDisplayName ? ` (${item.groupDisplayName})` : ""}`
          ),
        ].join("\n"),
        { manual: true, attributeChecklist: enumMissing.map((item) => item.displayName) }
      )
    );
  }

  if (tasks.length > 0) return tasks;

  if (coverage?.missingCount === 0) {
    return [
      buildGbpTask(audit, step, "gbp_checklist", step.title, checklistContent(step), {
        manual: true,
      }),
    ];
  }

  return [
    buildGbpTask(audit, step, "gbp_attributes", step.title, step.instruction, {
      enableRecommended: true,
    }),
  ];
}

export function buildReviewResponseTasks(
  audit: FullAuditPayload,
  step: GbpPlanStep,
  content: AuditGeneratedContent
): ExecutionTask[] {
  const responses =
    content.reviewResponses.length > 0
      ? content.reviewResponses
      : generateReviewResponses(audit);
  const customPayload = isCustomPlanStep(step.stepNumber) ? { customAction: true } : {};

  const rejectedDeletes = audit.reviews.reviews
    .filter((r) => r.replyState === "REJECTED" && r.replyText)
    .map((r) =>
      buildGbpTask(
        audit,
        step,
        "review_delete_reply",
        `Remove rejected reply for ${r.author.split(" ")[0] ?? "customer"}`,
        `Remove the rejected reply before posting a new one for review ${r.id}.`,
        { reviewId: r.id, reviewAuthor: r.author, replyState: r.replyState, ...customPayload }
      )
    );

  if (responses.length > 0) {
    const replyTasks = responses.map((r) => {
      const review = audit.reviews.reviews.find((rev) => rev.id === r.reviewId);
      const author = review?.author?.split(" ")[0] ?? "customer";
      const isRedraft = review?.replyState === "REJECTED";
      return buildGbpTask(
        audit,
        step,
        "review_response",
        isRedraft
          ? `Rewrite rejected reply for ${author} (${r.rating}★)`
          : `Respond to ${author} (${r.rating}★)`,
        r.response,
        {
          ...reviewPayload(audit, r.reviewId, r.rating),
          ...reviewResponseKeywordFields(
            audit,
            r.reviewId,
            r.response,
            review?.text ?? "",
            optionalReviewResponseKeywordWeave(r)
          ),
          ...customPayload,
        }
      );
    });
    return [...rejectedDeletes, ...replyTasks];
  }

  const template =
    step.copyBlocks?.[0]?.content ?? "Respond to all reviews within 24 hours.";
  return [
    ...rejectedDeletes,
    buildGbpTask(audit, step, "gbp_checklist", step.title, template, {
      manual: true,
      ...customPayload,
    }),
  ];
}

export function buildPhotoExecutionTasks(
  audit: FullAuditPayload,
  content: AuditGeneratedContent,
  step?: GbpPlanStep
): ExecutionTask[] {
    const photoStep: GbpPlanStep =
    step ??
    ({
      stepNumber: 6,
      title: "Photo Optimization",
      instruction:
        "Add photos of your work and other marketing photos to your Google Business Profile.",
      gbpAction: "upload_photo",
    } as GbpPlanStep);

  const categoryJobs = buildCategoryBatchUploadJobs(audit);
  const templateJobs =
    content.gbpPhotoJobs.length > 0 ? content.gbpPhotoJobs : buildTemplatePhotoJobs(audit);

  const jobs: GbpPhotoJob[] =
    categoryJobs.length > 0
      ? [
          ...categoryJobs.map((job) => ({
            title: job.title,
            category: job.category,
            hint: job.hint,
            aiGenerated: job.category === "AT_WORK",
          })),
          ...templateJobs.filter(
            (job) => job.category === "ADDITIONAL" && !categoryJobs.some((c) => c.category === job.category)
          ),
        ]
      : templateJobs;

  return jobs.map((job, i) =>
    buildGbpTask(audit, photoStep, "gbp_photo", job.title, photoJobDraftContent(job), {
      mediaFormat: "PHOTO",
      category: job.category,
      photoIndex: i + 1,
      imagePrompt: job.imagePrompt,
      aiGenerated: job.aiGenerated ?? false,
      hint: job.hint,
      targetKeywords: matchKeywordsInText(
        `${job.title} ${job.hint ?? ""}`,
        audit.rankings.keywords.map((k) => k.keyword)
      ),
    })
  );
}

export function tasksFromGbpPlanStep(
  audit: FullAuditPayload,
  step: GbpPlanStep,
  content: AuditGeneratedContent
): ExecutionTask[] {
  const templateStep = isCustomPlanStep(step.stepNumber)
    ? undefined
    : buildTemplateGbpPlan(audit).steps.find((s) => s.stepNumber === step.stepNumber);
  const resolvedAction = resolvePlanStepAction(step, templateStep);
  const resolvedStep: GbpPlanStep = { ...step, gbpAction: resolvedAction };

  if (resolvedStep.stepNumber === KEYWORD_PORTFOLIO_PLAN_STEP) {
    const portfolio = audit.keywordPortfolio ?? computeKeywordPortfolio(audit);
    return [
      buildGbpTask(
        audit,
        resolvedStep,
        "update_tracked_keywords",
        resolvedStep.title,
        [
          "Approve to update your tracked keyword portfolio to match Google search demand.",
          "",
          `Current: ${audit.rankings.keywords.map((item) => item.keyword).join(", ")}`,
          `Recommended: ${portfolio.recommendedKeywords.join(", ")}`,
          "",
          ...portfolio.recommendedSwaps.map(
            (swap) => `• ${swap.swapOut} → ${swap.swapIn}: ${swap.reason}`
          ),
        ].join("\n"),
        {
          applyRecommendations: true,
          recommendedKeywords: portfolio.recommendedKeywords,
        }
      ),
    ];
  }

  if (isReviewResponsePlanStep(resolvedStep)) {
    return buildReviewResponseTasks(audit, resolvedStep, content);
  }

  if (isReviewRequestPlanStep(resolvedStep)) {
    return [
      buildGbpTask(audit, resolvedStep, "review_request", resolvedStep.title, content.reviewRequestSms, {
        channel: "sms",
        batchSize: 15,
        ...(isCustomPlanStep(resolvedStep.stepNumber) ? { customAction: true } : {}),
      }),
    ];
  }

  if (isCustomPlanStep(resolvedStep.stepNumber) && resolvedAction === "manual") {
    if (resolvedStep.copyBlocks?.length) {
      return resolvedStep.copyBlocks.map((block, i) =>
        buildGbpTask(audit, resolvedStep, "gbp_checklist", block.label, block.content, {
          checklistIndex: i + 1,
          customAction: true,
        })
      );
    }
    return [
      buildGbpTask(
        audit,
        resolvedStep,
        "gbp_checklist",
        resolvedStep.title,
        checklistContent(resolvedStep),
        { manual: true, customAction: true }
      ),
    ];
  }

  if (resolvedStep.stepNumber === 6 || resolvedAction === "upload_photo") {
    return buildPhotoExecutionTasks(audit, content, resolvedStep);
  }

  const data = resolvedStep.actionData ?? {};

  switch (resolvedAction) {
    case "update_primary_category": {
      if (isStepSatisfied(audit, 1) || primaryCategoryUpdateIsNoOp(audit)) {
        return [];
      }
      const recommended =
        String(data.primaryCategory ?? step.recommended ?? resolveRecommendedPrimaryCategory(audit)).trim();
      const live = resolveLivePrimaryCategory(audit);
      if (categoryLabelsMatch(live, recommended)) {
        return [];
      }
      return [
        buildGbpTask(
          audit,
          step,
          "gbp_primary_category",
          step.title,
          recommended || step.title,
          { primaryCategory: recommended }
        ),
      ];
    }
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
          // Strip phone numbers, URLs, and HTML from generated drafts —
          // Google's guidelines keep contact details out of the description.
          sanitizeGbpDescriptionDraft(
            data.description ??
              step.copyBlocks?.[0]?.content ??
              content.gbpDescription
          ),
          {
            field: "description",
            targetKeywords: audit.rankings.keywords.map((k) => k.keyword),
          }
        ),
      ];
    case "add_service_items": {
      const blocks = step.copyBlocks ?? [];
      if (blocks.length > 0) {
        return blocks.map((block, i) => {
          const serviceName = block.label.replace(/^Service #\d+:\s*/i, "");
          return buildGbpTask(audit, step, "gbp_services", block.label, block.content, {
            serviceIndex: i + 1,
            serviceName,
            serviceDescription: block.content,
            targetKeyword: block.label,
          });
        });
      }
      return [
        buildGbpTask(audit, step, "gbp_checklist", step.title, checklistContent(step), {
          manual: true,
        }),
      ];
    }
    case "update_attributes":
      return buildAttributeExecutionTasks(audit, step);
    case "update_hours": {
      const year = new Date().getFullYear();
      const holidayLines = defaultUsHolidayDescriptions(year).map(
        (holiday) => `• ${holiday.name}: ${holiday.schedule}`
      );
      const needsRegular = !audit.gbp.completeness.hasHours;
      const needsHoliday = !audit.gbp.completeness.hasHolidayHours;
      const tasks: ExecutionTask[] = [];

      if (needsRegular || !audit.gbp.completeness.hasFullWeekHours) {
        tasks.push(
          buildGbpTask(
            audit,
            step,
            "gbp_hours",
            "Set regular business hours",
            [
              "Approve to set Mon–Fri 9:00 AM – 5:00 PM on your Google Business Profile.",
              "Adjust in Google Business Profile after publishing if your schedule differs.",
            ].join("\n"),
            { hoursAction: "update_regular_hours" }
          )
        );
      }

      if (needsHoliday) {
        tasks.push(
          buildGbpTask(
            audit,
            step,
            "gbp_hours",
            `Add ${year} holiday hours`,
            [
              "Approve to add major US holiday closures and modified hours to your Google Business Profile.",
              "Existing special hours for the same dates are preserved.",
              "",
              "Holidays to add:",
              ...holidayLines,
            ].join("\n"),
            { hoursAction: "update_holiday_hours", holidayYear: year }
          )
        );
      } else {
        tasks.push(
          buildGbpTask(
            audit,
            step,
            "gbp_hours",
            `Refresh ${year} holiday hours`,
            [
              "Approve to merge major US holiday closures and modified hours into your profile.",
              "Existing special hours for the same dates are preserved.",
              "",
              "Holidays included:",
              ...holidayLines,
            ].join("\n"),
            { hoursAction: "update_holiday_hours", holidayYear: year, refresh: true }
          )
        );
      }

      return tasks;
    }
    case "update_booking_attributes": {
      const bookingUri = data.bookingUri ?? audit.gbp.identity.website ?? "";
      if (!bookingUri) {
        return [
          buildGbpTask(audit, step, "gbp_checklist", step.title, checklistContent(step), {
            manual: true,
          }),
        ];
      }
      return [
        buildGbpTask(
          audit,
          step,
          "gbp_attributes",
          step.title,
          [
            "Approve to link your booking or appointment URL on applicable GBP attributes.",
            `Booking URL: ${bookingUri}`,
          ].join("\n"),
          { enableRecommended: true, bookingOnly: true, bookingUri }
        ),
      ];
    }
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
    case "upload_video": {
      const city = audit.gbp.identity.address.split(",").slice(-2, -1)[0]?.trim() ?? "your area";
      const keywords = audit.rankings.keywords.slice(0, 4);
      if (keywords.length === 0) {
        return [
          buildGbpTask(
            audit,
            step,
            "gbp_video",
            step.title,
            mediaUploadDraft(
              `30-60 second walkthrough of ${audit.clientName} in ${city}.`,
              "AT_WORK"
            ),
            { mediaFormat: "VIDEO", category: "AT_WORK" }
          ),
        ];
      }
      return keywords.map((kw, i) =>
        buildGbpTask(
          audit,
          step,
          "gbp_video",
          `Video: ${kw.keyword}`,
          mediaUploadDraft(
            `30-60 second video featuring "${kw.keyword}" for ${city} customers.`,
            "AT_WORK"
          ),
          {
            mediaFormat: "VIDEO",
            category: "AT_WORK",
            videoIndex: i + 1,
            targetKeywords: [kw.keyword],
          }
        )
      );
    }
    case "create_post": {
      // Google rejects posts with phone numbers or URLs in the body — the
      // Call CTA button carries the contact action.
      const posts = (
        content.googlePosts.length
          ? content.googlePosts
          : [data.postSummary ?? step.copyBlocks?.[0]?.content ?? step.instruction]
      ).map(sanitizeGbpPostDraft);
      const allKeywords = audit.rankings.keywords.map((k) => k.keyword);
      return posts.map((post, i) => {
        const matched = matchKeywordsInText(post, allKeywords);
        const targetKeywords =
          matched.length > 0 ? matched : allKeywords[i % allKeywords.length] ? [allKeywords[i % allKeywords.length]] : [];
        return buildGbpTask(audit, step, "google_post", `${step.title} (${i + 1}/${posts.length})`, post, {
          postIndex: i + 1,
          totalPosts: posts.length,
          platform: "google_business",
          targetKeywords,
        });
      });
    }
    default:
      break;
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
    return buildReviewResponseTasks(audit, step, content);
  }

  if (step.stepNumber === 5) {
    const blocks = step.copyBlocks ?? [];
    if (blocks.length > 0) {
      return blocks.map((block, i) =>
        buildGbpTask(audit, step, "gbp_checklist", block.label, block.content, {
          checklistIndex: i + 1,
          manual: true,
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

/** Gap-driven tasks not covered by the 15-step GBP plan (schema, social). */
export function tasksFromNapDrift(audit: FullAuditPayload): ExecutionTask[] {
  const drifts = audit.gbp.napDrift ?? [];
  if (drifts.length === 0) return [];

  const canonical = {
    name: audit.clientName,
    phone: audit.gbp.identity.phone,
    website: audit.gbp.identity.website,
    address: audit.gbp.identity.address,
  };

  return drifts.map((drift) => {
    const taskType =
      drift.field === "title"
        ? "gbp_title"
        : drift.field === "phone"
          ? "gbp_phone"
          : drift.field === "website"
            ? "gbp_website"
            : "gbp_address";

    return buildGbpTask(
      audit,
      {
        stepNumber: 0,
        title: `Sync ${drift.label}`,
        instruction: `Update Google to match your onboarding record for ${drift.label.toLowerCase()}.`,
      },
      taskType,
      `Sync ${drift.label}`,
      [
        `Sync ${drift.label} on your Google Business Profile.`,
        "",
        `Onboarding: ${drift.canonical}`,
        `Google now: ${drift.live}`,
        "",
        "Approve to update Google with your onboarding value.",
      ].join("\n"),
      {
        napField: drift.field,
        napCanonical: canonical,
        syncNap: true,
      }
    );
  });
}

export const SUPPLEMENTARY_GAP_IDS = new Set([
  "missing-schema",
  "low-social",
  "missing-holiday-hours",
  "missing-hours",
  "incomplete-week-hours",
  "low-attributes",
  "low-photos",
  "missing-video",
  "stale-media",
  "miscategorized-media",
  "low-media-engagement",
  "customer-photos-dominate",
  "zero-view-owner-photos",
  "missing-pubsub-notifications",
  "incomplete-notification-types",
  "performance-api-unavailable",
  "partial-performance-api",
  "no-search-keyword-data",
  "low-profile-conversions",
  "place-actions-api-unavailable",
  "missing-place-action-links",
  "incomplete-place-action-links",
  "local-posts-api-unavailable",
  "rejected-local-posts",
  "posts-without-cta",
  "reviews-api-unavailable",
  "rejected-review-replies",
  "pending-review-replies",
  "google-pending-edits",
  "google-suggested-edits",
  "nap-drift-title",
  "nap-drift-phone",
  "nap-drift-website",
  "nap-drift-address",
]);

export function tasksFromMediaMaintenance(audit: FullAuditPayload): ExecutionTask[] {
  const inventory = audit.gbp.content.mediaInventory ?? [];
  const coverage = audit.gbp.content.mediaCoverage;
  if (inventory.length === 0 || !coverage) return [];

  const items = inventory.map((item) => ({
    name: item.name,
    mediaFormat: item.mediaFormat,
    category: (item.category as GbpMediaCategory | null) ?? null,
    googleUrl: item.googleUrl,
    thumbnailUrl: item.thumbnailUrl,
    createTime: item.createTime,
    description: "",
    viewCount: item.viewCount == null ? null : String(item.viewCount),
    attribution: item.isCustomerPhoto
      ? { profileName: item.attributionName ?? "customer" }
      : undefined,
  }));

  const actions = buildMediaMaintenanceActions(items, coverage);
  if (actions.length === 0) return [];

  const step: GbpPlanStep = {
    stepNumber: 6,
    title: "Media maintenance",
    instruction: "Improve photo category coverage on your Google Business Profile.",
    gbpAction: "upload_photo",
  };

  return actions.map((action, index) => {
    const draftLines = [
      action.reason,
      "",
      `Current category: ${action.currentCategory ?? "ADDITIONAL"}`,
      "After deleting, upload a new photo with the correct category in the Photos section above.",
    ];
    if (action.viewCount !== null) {
      draftLines.push(`Views: ${formatMediaViewCountLabel(action.viewCount)}`);
    }

    return buildGbpTask(
      audit,
      step,
      "gbp_media_delete",
      "Remove low-performing photo",
      draftLines.join("\n"),
      {
        mediaName: action.mediaName,
        currentCategory: action.currentCategory,
        thumbnailUrl: action.thumbnailUrl,
        maintenanceIndex: index + 1,
        viewCount: action.viewCount,
      }
    );
  });
}

export function tasksFromVideoGaps(audit: FullAuditPayload): ExecutionTask[] {
  const coverage = audit.gbp.content.mediaCoverage;
  if (coverage?.hasVideo || audit.gbp.content.videoCount > 0) return [];

  const jobs = buildTemplateVideoJobs(audit);
  if (jobs.length === 0) return [];

  const step: GbpPlanStep = {
    stepNumber: 7,
    title: "Video upload",
    instruction: "Add short videos to boost profile engagement on Google Maps.",
    gbpAction: "upload_video",
  };

  return jobs.map((job, index) =>
    buildGbpTask(audit, step, "gbp_video", job.title, videoJobDraftContent(job), {
      mediaFormat: "VIDEO",
      category: job.category,
      videoIndex: index + 1,
      videoTotal: jobs.length,
      hint: job.hint,
      durationHint: job.durationHint,
    })
  );
}

export function tasksFromPlaceActionGaps(audit: FullAuditPayload): ExecutionTask[] {
  const coverage = audit.gbp.placeActions;
  if (!coverage?.apiAvailable || coverage.missingAvailableTypes.length === 0) return [];

  const website = audit.gbp.identity.website?.trim() || "https://";
  const step: GbpPlanStep = {
    stepNumber: 15,
    title: "Place action links",
    instruction: "Add booking, ordering, or shop links on your Google Business Profile.",
    gbpAction: "manual",
  };

  const missingTypes = coverage.missingAvailableTypes.map((type) => {
    const catalog = coverage.typeCatalog.find((item) => item.placeActionType === type);
    return {
      placeActionType: type,
      displayName: catalog?.displayName ?? placeActionTypeLabel(type),
      suggestedUri: website,
      recommended: coverage.missingRecommendedTypes.includes(type),
    };
  });

  const labels = missingTypes.map((item) => item.displayName);
  const configuredSummary =
    audit.gbp.placeActionLinks?.length ?
      [
        "",
        "Already configured:",
        ...audit.gbp.placeActionLinks.map(
          (link) => `• ${link.displayType}: ${link.uri}`
        ),
      ].join("\n")
      : "";

  return [
    buildGbpTask(
      audit,
      step,
      "gbp_place_action",
      "Add place action links",
      [
        `Add ${missingTypes.length} place action link${missingTypes.length === 1 ? "" : "s"} on your Google Business Profile:`,
        ...labels.map((label) => `• ${label}`),
        configuredSummary,
      ]
        .filter(Boolean)
        .join("\n"),
      {
        requiresPlaceActionInput: true,
        placeActionTypes: missingTypes,
        configuredLinks: audit.gbp.placeActionLinks ?? [],
        suggestedUri: website,
      }
    ),
  ];
}

export function tasksFromNotificationGaps(audit: FullAuditPayload): ExecutionTask[] {
  const coverage = audit.gbp.notifications;
  if (!coverage || coverage.configured && coverage.coverageScore >= 100) return [];
  if (!getGbpPubsubTopic()) return [];

  const step: GbpPlanStep = {
    stepNumber: 16,
    title: "Real-time GBP alerts",
    instruction: "Enable Pub/Sub notifications for time-sensitive listing events.",
    gbpAction: "manual",
  };

  const missingLabels = coverage.missingRecommendedTypes.map((type) =>
    notificationTypeLabel(type as GbpNotificationType)
  );

  return [
    buildGbpTask(
      audit,
      step,
      "gbp_notifications",
      "Enable recommended GBP alerts",
      [
        "Approve to subscribe your Google account to real-time Pub/Sub notifications.",
        "",
        coverage.configured
          ? `Missing alert types: ${missingLabels.join(", ") || "none"}`
          : "No Pub/Sub topic is configured on your GBP account yet.",
        "",
        "Alerts cover new reviews, Google edits, customer media, and Voice of Merchant status.",
      ].join("\n"),
      {
        syncNotifications: true,
        missingTypes: coverage.missingRecommendedTypes,
      }
    ),
  ];
}

export function tasksFromGoogleSuggestions(audit: FullAuditPayload): ExecutionTask[] {
  const suggestions = (audit.gbp.googleSuggestions ?? []).filter(
    (suggestion) => suggestion.kind !== "pending"
  );
  if (suggestions.length === 0) return [];

  const tasks: ExecutionTask[] = [];

  for (const [index, suggestion] of suggestions.entries()) {
    tasks.push(
      buildGbpTask(
        audit,
        {
          stepNumber: 0,
          title: "Review Google suggestion",
          instruction: `Google suggests changing ${suggestion.label}.`,
        },
        "gbp_accept_suggestion",
        `Accept Google change: ${suggestion.label}`,
        [
          `Google suggests updating ${suggestion.label}.`,
          "",
          `Your version: ${suggestion.ownerValue}`,
          `Google shows: ${suggestion.googleValue}`,
          "",
          "Approve to accept Google's version on your profile.",
        ].join("\n"),
        {
          suggestionField: suggestion.field,
          suggestionIndex: index + 1,
          ownerValue: suggestion.ownerValue,
          googleValue: suggestion.googleValue,
          suggestionAction: "accept",
        }
      )
    );

    tasks.push(
      buildGbpTask(
        audit,
        {
          stepNumber: 0,
          title: "Keep your version",
          instruction: `Reject Google's suggested change to ${suggestion.label}.`,
        },
        "gbp_reject_suggestion",
        `Keep your version: ${suggestion.label}`,
        [
          `Google is showing a different ${suggestion.label.toLowerCase()} than your preferred value.`,
          "",
          `Your version: ${suggestion.ownerValue}`,
          `Google shows: ${suggestion.googleValue}`,
          "",
          "Approve to keep your version and overwrite what customers see on Google.",
        ].join("\n"),
        {
          suggestionField: suggestion.field,
          suggestionIndex: index + 1,
          ownerValue: suggestion.ownerValue,
          googleValue: suggestion.googleValue,
          preferredValue: suggestion.ownerValue,
          suggestionAction: "reject",
        }
      )
    );
  }

  return tasks;
}
