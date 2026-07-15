import { buildTemplateContent, type AuditGeneratedContent } from "@/lib/llm/content";
import {
  buildAllGbpPlanSteps,
  buildTemplateGbpPlan,
  isRetiredGbpPlanStep,
  selectGbpPlanSteps,
} from "@/audit/phase2/gbp-plan";
import { isStepSatisfied } from "@/audit/phase2/counterfactual";
import { portfolioStepIsSatisfied } from "@/audit/phase2/keyword-portfolio";
import {
  countUnrespondedNegativeReviews,
  isReviewRecordResponded,
  isReviewResponseWorkSatisfied,
  syncReviewEngagementMetrics,
} from "@/audit/review-engagement";
import type { BusinessRecord } from "@/audit/businesses";
import type {
  ExecutionTask,
  FullAuditPayload,
  GbpOptimizationPlan,
  GbpPlanStep,
} from "../types";
import type { ClientConfig } from "../types";
import {
  appendExecutionTasks,
  appendExecutionTasksAdmin,
  listExecutionTasks,
  listExecutionTasksForBusinessAdmin,
  updateExecutionTask,
  updateExecutionTaskAdmin,
} from "@/audit/storage-execution";
import {
  loadAuditByIdFromSupabase,
  loadLatestAuditFromSupabase,
  saveAuditToSupabase,
} from "@/audit/storage-supabase";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { collectMissingReconcileTasks } from "./missing-tasks";
import { resolvePlanStepNumber } from "./plan-task-utils";
import { isMutableByReconcile } from "./task-identity";
import { PLAN_RECONCILE_FLAGS } from "@/lib/feature-flags";
import {
  categoryLabelsMatch,
  primaryCategoryUpdateIsNoOp,
  resolveLivePrimaryCategory,
} from "@/audit/phase2/gbp-category";
import {
  buildGbpDescriptionDraft,
  looksLikeKeywordStuffedDescription,
} from "@/lib/google/gbp-description-draft";
import { sanitizeGbpDescriptionDraft } from "@/lib/google/gbp-description";
import {
  generateReviewResponses,
  looksLikeMangledReviewReply,
} from "@/audit/phase3/content";
import {
  isPlanServiceCopyBlockLabel,
  parsePlanServiceBlock,
} from "@/lib/google/gbp-service-descriptions";
import { reviewResponseKeywordFields } from "@/lib/review-responses/payload";

/** Task types safe to auto-complete when live profile already satisfies the step/intent. */
const AUTO_COMPLETE_TYPES = new Set<ExecutionTask["type"]>([
  "gbp_description",
  "gbp_primary_category",
  "gbp_secondary_categories",
  "gbp_services",
  "gbp_hours",
  "gbp_attributes",
  "gbp_notifications",
  "gbp_place_action",
  "update_tracked_keywords",
  "gbp_title",
  "gbp_phone",
  "gbp_website",
  "gbp_address",
  "gbp_accept_suggestion",
  "gbp_reject_suggestion",
  "review_response",
  "review_delete_reply",
]);

export interface PlanReconcileComputation {
  nextAudit: FullAuditPayload;
  missingTasks: ExecutionTask[];
  tasksToComplete: ExecutionTask[];
  tasksToUpdate: ExecutionTask[];
  appendedStepNumbers: number[];
  refreshedStepCount: number;
}

export interface ReconcilePlanResult {
  audit: FullAuditPayload;
  createdTasks: ExecutionTask[];
  completedTasks: ExecutionTask[];
  updatedTasks: ExecutionTask[];
  appendedStepNumbers: number[];
  refreshedStepCount: number;
}

function mergePlanStepMetadata(
  existing: GbpPlanStep,
  fresh: GbpPlanStep | undefined
): GbpPlanStep {
  if (!fresh) return existing;

  const existingDescription = String(
    existing.actionData?.description ?? existing.copyBlocks?.[0]?.content ?? ""
  );
  const shouldRefreshDescription =
    existing.stepNumber === 3 &&
    Boolean(fresh.actionData?.description || fresh.copyBlocks?.[0]?.content) &&
    (looksLikeKeywordStuffedDescription(existingDescription) || !existingDescription.trim());

  return {
    ...existing,
    current: fresh.current ?? existing.current,
    recommended: fresh.recommended ?? existing.recommended,
    bullets: fresh.bullets?.length ? fresh.bullets : existing.bullets,
    instruction: existing.instruction || fresh.instruction,
    ...(shouldRefreshDescription
      ? {
          copyBlocks: fresh.copyBlocks ?? existing.copyBlocks,
          actionData: {
            ...(existing.actionData ?? {}),
            ...(fresh.actionData ?? {}),
          },
        }
      : {}),
    // Keep LLM gbpAction / title; refresh live-facing fields (and stuffed description drafts).
  };
}

/** Drop retired steps, refresh existing metadata, and append newly required steps. */
export function refreshGbpPlanForReconcile(
  audit: FullAuditPayload
): { plan: GbpOptimizationPlan | null; appendedStepNumbers: number[]; refreshedStepCount: number } {
  const existingPlan = audit.strategy.gbpPlan;
  if (!existingPlan) {
    return { plan: null, appendedStepNumbers: [], refreshedStepCount: 0 };
  }

  const allFresh = buildAllGbpPlanSteps(audit);
  const freshByNumber = new Map(allFresh.map((step) => [step.stepNumber, step]));
  const required = selectGbpPlanSteps(audit, allFresh);
  const activeExistingSteps = existingPlan.steps.filter(
    (step) => !isRetiredGbpPlanStep(step.stepNumber)
  );
  const existingNumbers = new Set(activeExistingSteps.map((step) => step.stepNumber));

  let refreshedStepCount = 0;
  const mergedSteps = activeExistingSteps.map((step) => {
    const fresh = freshByNumber.get(step.stepNumber);
    const next = mergePlanStepMetadata(step, fresh);
    if (
      next.current !== step.current ||
      next.recommended !== step.recommended ||
      JSON.stringify(next.bullets ?? []) !== JSON.stringify(step.bullets ?? [])
    ) {
      refreshedStepCount += 1;
    }
    return next;
  });

  const appended: GbpPlanStep[] = [];
  for (const step of required) {
    if (existingNumbers.has(step.stepNumber)) continue;
    // Don't invent custom LLM steps; only append template/required steps.
    if (step.stepNumber >= 18) continue;
    appended.push(step);
    existingNumbers.add(step.stepNumber);
  }

  const template = buildTemplateGbpPlan(audit);

  return {
    plan: {
      ...existingPlan,
      currentState: template.currentState,
      keywordRankings: template.keywordRankings,
      targetKeywords: template.targetKeywords,
      steps: [...mergedSteps, ...appended],
    },
    appendedStepNumbers: appended.map((step) => step.stepNumber),
    refreshedStepCount,
  };
}

function reviewAlreadyReplied(audit: FullAuditPayload, reviewId: string): boolean {
  const review = audit.reviews.reviews.find((item) => item.id === reviewId);
  if (!review) return true;
  return isReviewRecordResponded(review);
}

function suggestionFieldStillOpen(audit: FullAuditPayload, field: string): boolean {
  const suggestions = audit.gbp.googleSuggestions ?? [];
  return suggestions.some(
    (suggestion) => suggestion.field === field && suggestion.kind !== "pending"
  );
}

function napFieldStillDrifting(audit: FullAuditPayload, field: string): boolean {
  return (audit.gbp.napDrift ?? []).some((drift) => drift.field === field);
}

/** Decide which open tasks can be marked completed from live audit state. */
export function selectTasksToAutoComplete(
  audit: FullAuditPayload,
  existing: ExecutionTask[]
): ExecutionTask[] {
  const completed: ExecutionTask[] = [];

  for (const task of existing) {
    const stepNumber = resolvePlanStepNumber(task);

    if (task.type === "gbp_checklist" && stepNumber === 11 && isReviewResponseWorkSatisfied(audit)) {
      if (isMutableByReconcile(task) || task.status === "approved") {
        completed.push(task);
      }
      continue;
    }

    if (task.type === "update_tracked_keywords" && portfolioStepIsSatisfied(audit)) {
      if (isMutableByReconcile(task) || task.status === "approved") {
        completed.push(task);
      }
      continue;
    }

    if (!isMutableByReconcile(task)) continue;

    if (!AUTO_COMPLETE_TYPES.has(task.type)) continue;

    if (task.type === "review_response" || task.type === "review_delete_reply") {
      const reviewId = String(task.payload.reviewId ?? "");
      if (reviewId && reviewAlreadyReplied(audit, reviewId)) {
        completed.push(task);
      }
      continue;
    }

    if (task.type === "gbp_accept_suggestion" || task.type === "gbp_reject_suggestion") {
      const field = String(task.payload.suggestionField ?? "");
      if (field && !suggestionFieldStillOpen(audit, field)) {
        completed.push(task);
      }
      continue;
    }

    if (
      task.type === "gbp_title" ||
      task.type === "gbp_phone" ||
      task.type === "gbp_website" ||
      task.type === "gbp_address"
    ) {
      const napField = String(task.payload.napField ?? "");
      if (napField) {
        if (!napFieldStillDrifting(audit, napField)) completed.push(task);
        continue;
      }
    }

    if (task.type === "gbp_primary_category") {
      const payloadCategory = String(task.payload.primaryCategory ?? task.draftContent ?? "");
      const live = resolveLivePrimaryCategory(audit);
      if (
        primaryCategoryUpdateIsNoOp(audit) ||
        categoryLabelsMatch(live, payloadCategory) ||
        (stepNumber != null && isStepSatisfied(audit, stepNumber))
      ) {
        completed.push(task);
      }
      continue;
    }

    if (stepNumber != null && isStepSatisfied(audit, stepNumber)) {
      completed.push(task);
    }
  }

  return completed;
}

function withReconcileCompletion(task: ExecutionTask, now: string): ExecutionTask {
  return {
    ...task,
    status: "completed",
    completedAt: now,
    result: "Auto-completed by plan reconcile (live profile already satisfies this work).",
  };
}

/** Rewrite pending description drafts that still use the keyword-stuffed template. */
export function selectDescriptionDraftsToRefresh(
  audit: FullAuditPayload,
  existing: ExecutionTask[]
): ExecutionTask[] {
  const nextDraft = sanitizeGbpDescriptionDraft(buildGbpDescriptionDraft(audit));
  const refreshed: ExecutionTask[] = [];

  for (const task of existing) {
    if (!isMutableByReconcile(task)) continue;
    if (task.type !== "gbp_description") continue;
    if (!looksLikeKeywordStuffedDescription(task.draftContent)) continue;
    if (sanitizeGbpDescriptionDraft(task.draftContent) === nextDraft) continue;

    refreshed.push({
      ...task,
      draftContent: nextDraft,
      payload: {
        ...task.payload,
        field: "description",
        targetKeywords: audit.rankings.keywords.map((item) => item.keyword),
        descriptionDraftRefreshedAt: new Date().toISOString(),
      },
    });
  }

  return refreshed;
}

/** Rewrite pending review replies that still use the mangled legacy template. */
export function selectReviewResponseDraftsToRefresh(
  audit: FullAuditPayload,
  existing: ExecutionTask[],
  content?: AuditGeneratedContent
): ExecutionTask[] {
  const drafts =
    content?.reviewResponses && content.reviewResponses.length > 0
      ? content.reviewResponses
      : generateReviewResponses(audit);
  const byReviewId = new Map(drafts.map((draft) => [draft.reviewId, draft]));
  const refreshed: ExecutionTask[] = [];

  for (const task of existing) {
    if (!isMutableByReconcile(task)) continue;
    if (task.type !== "review_response") continue;
    if (!looksLikeMangledReviewReply(task.draftContent)) continue;

    const reviewId = String(task.payload.reviewId ?? "");
    const draft = byReviewId.get(reviewId);
    if (!draft?.response?.trim()) continue;
    if (draft.response.trim() === task.draftContent.trim()) continue;

    const reviewText =
      typeof task.payload.reviewText === "string"
        ? task.payload.reviewText
        : audit.reviews.reviews.find((row) => row.id === reviewId)?.text ?? "";

    refreshed.push({
      ...task,
      draftContent: draft.response,
      payload: {
        ...task.payload,
        ...reviewResponseKeywordFields(
          audit,
          reviewId,
          draft.response,
          reviewText,
          draft.keywordWeave
        ),
        reviewReplyDraftRefreshedAt: new Date().toISOString(),
      },
    });
  }

  return refreshed;
}

/** Upgrade legacy step-5 product/checklist tasks to publishable GBP service tasks. */
export function selectStep5ServiceTasksToUpgrade(
  audit: FullAuditPayload,
  existing: ExecutionTask[]
): ExecutionTask[] {
  const upgraded: ExecutionTask[] = [];

  for (const task of existing) {
    if (!isMutableByReconcile(task)) continue;
    if (resolvePlanStepNumber(task) !== 5) continue;

    const label = task.title.replace(/^Step \d+:\s*/i, "").trim();
    if (!isPlanServiceCopyBlockLabel(label)) continue;

    const parsed = parsePlanServiceBlock(label, task.draftContent, audit);
    const currentName = String(task.payload.serviceName ?? label);

    if (task.type === "gbp_services") {
      if (currentName === parsed.serviceName && task.draftContent === parsed.serviceDescription) {
        continue;
      }
      upgraded.push({
        ...task,
        title: `Step 5: ${parsed.serviceName}`,
        draftContent: parsed.serviceDescription,
        payload: {
          ...task.payload,
          serviceName: parsed.serviceName,
          serviceDescription: parsed.serviceDescription,
          targetKeyword: parsed.keyword ?? label,
          upgradedFromChecklist: true,
        },
      });
      continue;
    }

    if (task.type !== "gbp_checklist") continue;

    upgraded.push({
      ...task,
      type: "gbp_services",
      title: `Step 5: ${parsed.serviceName}`,
      draftContent: parsed.serviceDescription,
      payload: {
        ...task.payload,
        serviceName: parsed.serviceName,
        serviceDescription: parsed.serviceDescription,
        targetKeyword: parsed.keyword ?? label,
        manual: undefined,
        checklistIndex: undefined,
        upgradedFromChecklist: true,
      },
    });
  }

  return upgraded;
}

/**
 * Pure reconcile computation: refresh plan metadata, find missing tasks,
 * and select stale pending tasks to complete. No I/O.
 */
export function computePlanReconcile(
  audit: FullAuditPayload,
  existing: ExecutionTask[],
  options: { content?: AuditGeneratedContent; now?: string } = {}
): PlanReconcileComputation {
  const now = options.now ?? new Date().toISOString();
  syncReviewEngagementMetrics(audit);
  const { plan, appendedStepNumbers, refreshedStepCount } = refreshGbpPlanForReconcile(audit);

  const nextAudit: FullAuditPayload = plan
    ? {
        ...audit,
        strategy: {
          ...audit.strategy,
          gbpPlan: plan,
          planReconciledAt: now,
        },
      }
    : {
        ...audit,
        strategy: {
          ...audit.strategy,
          planReconciledAt: now,
        },
      };

  const content = options.content ?? buildTemplateContent(nextAudit);
  const missingTasks = collectMissingReconcileTasks(nextAudit, existing, { content });
  const tasksToComplete = selectTasksToAutoComplete(nextAudit, existing).map((task) =>
    withReconcileCompletion(task, now)
  );
  const completedIds = new Set(tasksToComplete.map((task) => task.id));
  const tasksToUpdate = [
    ...selectDescriptionDraftsToRefresh(nextAudit, existing),
    ...selectReviewResponseDraftsToRefresh(nextAudit, existing, content),
    ...selectStep5ServiceTasksToUpgrade(nextAudit, existing),
  ].filter((task) => !completedIds.has(task.id));

  return {
    nextAudit,
    missingTasks,
    tasksToComplete,
    tasksToUpdate,
    appendedStepNumbers,
    refreshedStepCount,
  };
}

export interface ReconcilePlanOptions {
  content?: AuditGeneratedContent;
  /** Skip persistence (tests). */
  dryRun?: boolean;
  /** When set, require this audit id (user-triggered refresh). */
  auditId?: string;
}

function toReconcileResult(computation: PlanReconcileComputation): ReconcilePlanResult {
  return {
    audit: computation.nextAudit,
    createdTasks: computation.missingTasks,
    completedTasks: computation.tasksToComplete,
    updatedTasks: computation.tasksToUpdate,
    appendedStepNumbers: computation.appendedStepNumbers,
    refreshedStepCount: computation.refreshedStepCount,
  };
}

/**
 * Cron/admin path: load latest audit + execution tasks with service role,
 * reconcile, append missing tasks, auto-complete stale pending work.
 */
export async function reconcilePlanForBusiness(
  row: BusinessRecord,
  options: ReconcilePlanOptions = {}
): Promise<ReconcilePlanResult | null> {
  if (!PLAN_RECONCILE_FLAGS.enabled) {
    return null;
  }

  const audit = await loadLatestAuditForBusinessAdmin(
    row.user_id,
    row.id,
    row.slug,
    row.name
  );
  if (!audit) return null;
  if (options.auditId && audit.auditId !== options.auditId) return null;

  const existing = await listExecutionTasksForBusinessAdmin(
    row.user_id,
    row.id,
    audit.auditId
  );

  const computation = computePlanReconcile(audit, existing, {
    content: options.content,
  });

  if (!options.dryRun) {
    if (computation.missingTasks.length > 0) {
      await appendExecutionTasksAdmin(row.user_id, row.id, computation.missingTasks);
    }

    for (const task of computation.tasksToComplete) {
      await updateExecutionTaskAdmin(task.id, {
        status: "completed",
        completedAt: task.completedAt,
        result: task.result,
      });
    }

    for (const task of computation.tasksToUpdate) {
      await updateExecutionTaskAdmin(task.id, {
        draftContent: task.draftContent,
        payload: task.payload,
      });
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("audit_runs")
      .update({ payload: computation.nextAudit })
      .eq("user_id", row.user_id)
      .eq("business_id", row.id)
      .eq("audit_id", audit.auditId);

    if (error) {
      throw new Error(`Failed to persist reconciled plan: ${error.message}`);
    }
  }

  return toReconcileResult(computation);
}

/**
 * Authenticated user path: same reconcile logic via session-scoped storage.
 */
export async function reconcilePlanForUser(
  userId: string,
  client: ClientConfig,
  options: ReconcilePlanOptions = {}
): Promise<ReconcilePlanResult | null> {
  if (!PLAN_RECONCILE_FLAGS.enabled) {
    return null;
  }
  if (!client.businessId) {
    throw new Error("Business id is required to reconcile the plan");
  }

  const raw = options.auditId
    ? await loadAuditByIdFromSupabase(userId, client.id, options.auditId)
    : await loadLatestAuditFromSupabase(userId, client.id, {
        businessName: client.name,
        businessUuid: client.businessId,
      });

  if (!raw) return null;
  if (options.auditId && raw.auditId !== options.auditId) return null;

  const existing = await listExecutionTasks(userId, client.id, raw.auditId);
  const computation = computePlanReconcile(raw, existing, {
    content: options.content,
  });

  if (!options.dryRun) {
    if (computation.missingTasks.length > 0) {
      await appendExecutionTasks(userId, client, computation.missingTasks);
    }

    for (const task of computation.tasksToComplete) {
      await updateExecutionTask(userId, task.id, {
        status: "completed",
        completedAt: task.completedAt,
        result: task.result,
      });
    }

    for (const task of computation.tasksToUpdate) {
      await updateExecutionTask(userId, task.id, {
        draftContent: task.draftContent,
        payload: task.payload,
      });
    }

    await saveAuditToSupabase(userId, client.businessId, computation.nextAudit);
  }

  return toReconcileResult(computation);
}
