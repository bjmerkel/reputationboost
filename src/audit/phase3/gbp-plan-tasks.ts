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
import { normalizeTextContent } from "@/lib/llm/normalize-content";
import { buildTemplateGbpPlan } from "@/audit/phase2/gbp-plan";
import { resolvePlanStepAction } from "./gbp-plan-actions";
import { matchKeywordsInText } from "@/audit/attribution/keywords";
import { getPhaseForStep } from "./plan-phases";
import { isCustomPlanStep } from "./plan-custom-steps";
import { buildTaskPayloadContext } from "./step-context";

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
    "gbp_title",
    "gbp_address",
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
      instruction: "Upload marketing photos to your Google Business Profile.",
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
          {
            field: "description",
            targetKeywords: audit.rankings.keywords.map((k) => k.keyword),
          }
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
    case "update_hours": {
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
            "Add holiday hours",
            [
              "Approve to add US holiday closures and modified hours (July 4, Thanksgiving, Christmas, etc.).",
            ].join("\n"),
            { hoursAction: "update_holiday_hours" }
          )
        );
      }

      if (tasks.length > 0) return tasks;

      return [
        buildGbpTask(audit, step, "gbp_checklist", step.title, checklistContent(step), {
          manual: true,
        }),
      ];
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
      const posts = content.googlePosts.length
        ? content.googlePosts
        : [data.postSummary ?? step.copyBlocks?.[0]?.content ?? step.instruction];
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
    const rejectedDeletes = audit.reviews.reviews
      .filter((r) => r.replyState === "REJECTED" && r.replyText)
      .map((r) =>
        buildGbpTask(
          audit,
          step,
          "review_delete_reply",
          `Remove rejected reply for ${r.author.split(" ")[0] ?? "customer"}`,
          `Remove the rejected reply before posting a new one for review ${r.id}.`,
          { reviewId: r.id, reviewAuthor: r.author, replyState: r.replyState }
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
            targetKeywords: matchKeywordsInText(
              `${r.response} ${review?.text ?? ""}`,
              audit.rankings.keywords.map((k) => k.keyword)
            ),
          }
        );
      });
      return [...rejectedDeletes, ...replyTasks];
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
  "citation-mismatch",
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
    viewCount: String(item.viewCount),
    attribution: item.isCustomerPhoto
      ? { profileName: item.attributionName ?? "customer" }
      : undefined,
  }));

  const actions = buildMediaMaintenanceActions(items, coverage);
  if (actions.length === 0) return [];

  const step: GbpPlanStep = {
    stepNumber: 0,
    title: "Media maintenance",
    instruction: "Improve photo category coverage on your Google Business Profile.",
    gbpAction: "upload_photo",
  };

  return actions.map((action, index) => {
    const type = action.type === "recategorize" ? "gbp_media_recategorize" : "gbp_media_delete";
    const title =
      action.type === "recategorize"
        ? `Recategorize photo to ${mediaCategoryLabel(action.targetCategory!)}`
        : "Remove low-performing photo";

    return buildGbpTask(
      audit,
      step,
      type,
      title,
      [
        action.reason,
        "",
        `Current category: ${action.currentCategory ?? "ADDITIONAL"}`,
        action.targetCategory
          ? `Target category: ${mediaCategoryLabel(action.targetCategory)}`
          : "After deleting, upload a better categorized replacement.",
        `Views: ${action.viewCount}`,
      ].join("\n"),
      {
        mediaName: action.mediaName,
        targetCategory: action.targetCategory,
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
    stepNumber: 0,
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
  if (!coverage?.apiAvailable || coverage.missingRecommendedTypes.length === 0) return [];

  const website = audit.gbp.identity.website?.trim();
  const step: GbpPlanStep = {
    stepNumber: 0,
    title: "Place action links",
    instruction: "Add booking, ordering, or shop links on your Google Business Profile.",
    gbpAction: "manual",
  };

  return coverage.missingRecommendedTypes.map((type) => {
    const label = placeActionTypeLabel(type);
    const suggestedUri = website || "https://";
    return buildGbpTask(
      audit,
      step,
      "gbp_place_action",
      `Add ${label} link`,
      [
        `Add a ${label.toLowerCase()} link on your Google Business Profile.`,
        "",
        "Paste the destination URL on the first line, then approve to publish.",
        "",
        suggestedUri,
      ].join("\n"),
      {
        placeActionType: type,
        suggestedUri,
        syncPlaceAction: true,
      }
    );
  });
}

export function tasksFromNotificationGaps(audit: FullAuditPayload): ExecutionTask[] {
  const coverage = audit.gbp.notifications;
  if (!coverage || coverage.configured && coverage.coverageScore >= 100) return [];
  if (!getGbpPubsubTopic()) return [];

  const step: GbpPlanStep = {
    stepNumber: 0,
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
  const suggestions = audit.gbp.googleSuggestions ?? [];
  if (suggestions.length === 0) return [];

  return suggestions.map((suggestion, index) =>
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
        `Current: ${suggestion.ownerValue}`,
        `Google suggests: ${suggestion.googleValue}`,
        "",
        "Approve to accept Google's version on your profile.",
      ].join("\n"),
      {
        suggestionField: suggestion.field,
        suggestionIndex: index + 1,
        ownerValue: suggestion.ownerValue,
        googleValue: suggestion.googleValue,
      }
    )
  );
}
