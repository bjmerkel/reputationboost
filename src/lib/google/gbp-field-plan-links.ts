import type {
  ExecutionTask,
  ExecutionType,
  GbpLocationInventory,
  GbpLocationInventoryField,
} from "@/audit/types";
import { GOOGLE_UPDATES_STEP_NUMBER } from "./gbp-field-plan-map";
import { resolvePlanStepNumber } from "@/audit/phase3/plan-task-utils";

export interface GbpFieldPlanLink {
  planStepNumber: number;
  taskTypes?: ExecutionType[];
  alternateStepNumber?: number;
  alternateTaskTypes?: ExecutionType[];
  fixLabel?: string;
  scrollTarget?: "google-updates";
}

const FIELD_PLAN_LINKS: Record<string, GbpFieldPlanLink> = {
  title: { planStepNumber: GOOGLE_UPDATES_STEP_NUMBER, taskTypes: ["gbp_title"] },
  "phoneNumbers.primaryPhone": {
    planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
    taskTypes: ["gbp_phone"],
    fixLabel: "Review updates",
  },
  "phoneNumbers.additionalPhones": {
    planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
    taskTypes: ["gbp_phone"],
    fixLabel: "Review updates",
  },
  storefrontAddress: {
    planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
    taskTypes: ["gbp_address"],
    fixLabel: "Review updates",
  },
  websiteUri: {
    planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
    taskTypes: ["gbp_website"],
    fixLabel: "Review updates",
  },
  "categories.primaryCategory": {
    planStepNumber: 1,
    taskTypes: ["gbp_primary_category"],
    fixLabel: "Update category",
  },
  "categories.additionalCategories": {
    planStepNumber: 2,
    taskTypes: ["gbp_secondary_categories"],
    fixLabel: "Add categories",
  },
  "profile.description": {
    planStepNumber: 3,
    taskTypes: ["gbp_description"],
    fixLabel: "Rewrite description",
  },
  serviceItems: {
    planStepNumber: 4,
    taskTypes: ["gbp_services"],
    fixLabel: "Add services",
  },
  regularHours: { planStepNumber: 12, taskTypes: ["gbp_hours"], fixLabel: "Update hours" },
  specialHours: { planStepNumber: 12, taskTypes: ["gbp_hours"], fixLabel: "Update hours" },
  moreHours: { planStepNumber: 12, taskTypes: ["gbp_hours"], fixLabel: "Update hours" },
  attributes: {
    planStepNumber: 13,
    taskTypes: ["gbp_attributes"],
    fixLabel: "Enable attributes",
  },
  "content.photos": {
    planStepNumber: 6,
    taskTypes: ["gbp_photo", "gbp_media_recategorize", "gbp_media_delete"],
    fixLabel: "Add photos",
  },
  "content.posts": {
    planStepNumber: 8,
    taskTypes: ["google_post"],
    fixLabel: "Create post",
  },
  "engagement.reviews": {
    planStepNumber: 11,
    taskTypes: ["review_response", "review_delete_reply"],
    alternateStepNumber: 10,
    alternateTaskTypes: ["review_request"],
    fixLabel: "Respond to reviews",
  },
  "metadata.hasGoogleUpdated": {
    planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
    taskTypes: ["gbp_accept_suggestion", "gbp_reject_suggestion"],
    fixLabel: "Review updates",
    scrollTarget: "google-updates",
  },
  "metadata.hasPendingEdits": {
    planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
    fixLabel: "View status",
    scrollTarget: "google-updates",
  },
};

const TASK_STATUS_PRIORITY: ExecutionTask["status"][] = [
  "pending_approval",
  "failed",
  "approved",
  "scheduled",
  "completed",
  "rejected",
];

export function planLinkForApiPath(apiPath: string): GbpFieldPlanLink | undefined {
  return FIELD_PLAN_LINKS[apiPath];
}

function findTaskForStep(
  tasks: ExecutionTask[],
  planStepNumber: number,
  taskTypes?: ExecutionType[]
): ExecutionTask | undefined {
  const candidates = tasks.filter((task) => {
    const step = resolvePlanStepNumber(task);
    if (step !== planStepNumber) return false;
    if (taskTypes && taskTypes.length > 0 && !taskTypes.includes(task.type)) return false;
    return true;
  });

  if (candidates.length === 0) return undefined;

  return [...candidates].sort(
    (a, b) => TASK_STATUS_PRIORITY.indexOf(a.status) - TASK_STATUS_PRIORITY.indexOf(b.status)
  )[0];
}

function resolveFieldPlanLink(
  field: GbpLocationInventoryField,
  tasks: ExecutionTask[],
  planStepNumbers?: Set<number>
): Pick<
  GbpLocationInventoryField,
  "planStepNumber" | "planTaskId" | "planTaskStatus" | "planFixLabel" | "planScrollTarget"
> {
  if (field.status === "good" && !field.hasConflict) {
    return {};
  }

  if (field.hasConflict) {
    const conflictTask = findTaskForStep(tasks, GOOGLE_UPDATES_STEP_NUMBER, [
      "gbp_accept_suggestion",
      "gbp_reject_suggestion",
    ]);
    if (conflictTask) {
      return {
        planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
        planTaskId: conflictTask.id,
        planTaskStatus: conflictTask.status,
        planFixLabel: "Resolve conflict",
        planScrollTarget: "google-updates",
      };
    }

    return {
      planStepNumber: GOOGLE_UPDATES_STEP_NUMBER,
      planFixLabel: "Review updates",
      planScrollTarget: "google-updates",
    };
  }

  const config = planLinkForApiPath(field.apiPath);
  if (!config) return {};

  let task =
    findTaskForStep(tasks, config.planStepNumber, config.taskTypes) ??
    (config.alternateStepNumber != null
      ? findTaskForStep(tasks, config.alternateStepNumber, config.alternateTaskTypes)
      : undefined);

  const planStepNumber =
    task != null
      ? (resolvePlanStepNumber(task) ?? config.planStepNumber)
      : config.alternateStepNumber != null &&
          findTaskForStep(tasks, config.alternateStepNumber, config.alternateTaskTypes)
        ? config.alternateStepNumber
        : config.planStepNumber;

  if (!field.editable && planStepNumber === GOOGLE_UPDATES_STEP_NUMBER && !task) {
    return {};
  }

  if (planStepNumbers && !planStepNumbers.has(planStepNumber)) {
    return {};
  }

  return {
    planStepNumber,
    planTaskId: task?.id,
    planTaskStatus: task?.status,
    planFixLabel: task
      ? fixLabelForTask(task)
      : config.fixLabel ?? "Fix in plan",
    planScrollTarget: config.scrollTarget,
  };
}

function fixLabelForTask(task?: ExecutionTask): string {
  if (!task) return "Fix in plan";
  if (task.status === "pending_approval") return "Review fix";
  if (task.status === "completed") return "View in plan";
  if (task.status === "failed") return "Retry in plan";
  return "Fix in plan";
}

export function enrichInventoryWithPlanLinks(
  inventory: GbpLocationInventory,
  tasks: ExecutionTask[],
  options?: { planStepNumbers?: Set<number> }
): GbpLocationInventory {
  const fields = inventory.fields.map((field) => ({
    ...field,
    ...resolveFieldPlanLink(field, tasks, options?.planStepNumbers),
  }));

  return { ...inventory, fields };
}

export function planScrollElementId(
  stepNumber: number,
  scrollTarget?: GbpLocationInventoryField["planScrollTarget"]
): string {
  if (scrollTarget === "google-updates") return "google-updates-panel";
  return `plan-step-${stepNumber}`;
}
