import { buildTemplateContent, type AuditGeneratedContent } from "@/lib/llm/content";
import {
  buildAllGbpPlanSteps,
  buildTemplateGbpPlan,
  selectGbpPlanSteps,
} from "@/audit/phase2/gbp-plan";
import { isStepSatisfied } from "@/audit/phase2/counterfactual";
import type { BusinessRecord } from "@/audit/businesses";
import type {
  ExecutionTask,
  FullAuditPayload,
  GbpOptimizationPlan,
  GbpPlanStep,
} from "../types";
import {
  appendExecutionTasksAdmin,
  listExecutionTasksForBusinessAdmin,
  updateExecutionTaskAdmin,
} from "@/audit/storage-execution";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import { collectMissingReconcileTasks } from "./missing-tasks";
import { resolvePlanStepNumber } from "./plan-task-utils";
import { isMutableByReconcile } from "./task-identity";
import { PLAN_RECONCILE_FLAGS } from "@/lib/feature-flags";

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
  appendedStepNumbers: number[];
  refreshedStepCount: number;
}

export interface ReconcilePlanResult {
  audit: FullAuditPayload;
  createdTasks: ExecutionTask[];
  completedTasks: ExecutionTask[];
  appendedStepNumbers: number[];
  refreshedStepCount: number;
}

function mergePlanStepMetadata(
  existing: GbpPlanStep,
  fresh: GbpPlanStep | undefined
): GbpPlanStep {
  if (!fresh) return existing;
  return {
    ...existing,
    current: fresh.current ?? existing.current,
    recommended: fresh.recommended ?? existing.recommended,
    bullets: fresh.bullets?.length ? fresh.bullets : existing.bullets,
    instruction: existing.instruction || fresh.instruction,
    // Keep LLM gbpAction / copyBlocks / title; only refresh live-facing fields.
  };
}

/** Refresh current/recommended on existing steps; append newly required steps. */
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
  const existingNumbers = new Set(existingPlan.steps.map((step) => step.stepNumber));

  let refreshedStepCount = 0;
  const mergedSteps = existingPlan.steps.map((step) => {
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
  return Boolean(review.replyText?.trim()) || review.replyState === "LIVE";
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
    if (!isMutableByReconcile(task)) continue;
    if (!AUTO_COMPLETE_TYPES.has(task.type)) continue;

    const stepNumber = resolvePlanStepNumber(task);

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

  return {
    nextAudit,
    missingTasks,
    tasksToComplete,
    appendedStepNumbers,
    refreshedStepCount,
  };
}

export interface ReconcilePlanForBusinessOptions {
  content?: AuditGeneratedContent;
  /** Skip persistence (tests). */
  dryRun?: boolean;
}

/**
 * Load latest audit + execution tasks, reconcile, append missing tasks,
 * auto-complete stale pending work, and patch the audit payload.
 */
export async function reconcilePlanForBusiness(
  row: BusinessRecord,
  options: ReconcilePlanForBusinessOptions = {}
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

  return {
    audit: computation.nextAudit,
    createdTasks: computation.missingTasks,
    completedTasks: computation.tasksToComplete,
    appendedStepNumbers: computation.appendedStepNumbers,
    refreshedStepCount: computation.refreshedStepCount,
  };
}
