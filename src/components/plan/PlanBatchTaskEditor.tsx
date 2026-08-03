"use client";

import type {
  ExecutionTask,
  GbpAttributeCoverage,
  GbpMediaCoverage,
  GbpPlaceActionCoverage,
  GbpPlaceActionLinkSummary,
  PlanStepContext,
} from "@/audit/types";
import type { ActionAttribution } from "@/audit/types/timeseries";
import { resolvePlanStepNumber } from "@/audit/phase3/plan-task-utils";
import type { PlanTaskActions } from "@/hooks/usePlanTasks";
import ReviewDisputePanel from "@/components/review-disputes/ReviewDisputePanel";
import ReviewRequestPanel from "@/components/review-requests/ReviewRequestPanel";
import PlanStepAttributes from "./PlanStepAttributes";
import PlanStepHours from "./PlanStepHours";
import PlanStepPhotos from "./PlanStepPhotos";
import PlanStepPlaceActions from "./PlanStepPlaceActions";
import PlanStepTaskRow from "./PlanStepTaskRow";
import PlanStepVideos from "./PlanStepVideos";

export interface PlanBatchTaskEditorContext {
  attributeCoverage?: GbpAttributeCoverage;
  mediaCoverage?: GbpMediaCoverage;
  placeActionCoverage?: GbpPlaceActionCoverage;
  placeActionLinks?: GbpPlaceActionLinkSummary[];
  businessName?: string;
  businessPhone?: string;
  businessWebsite?: string;
  reviewUrl?: string | null;
  businessId?: string | null;
  initialFocusKeyword?: string | null;
}

interface PlanBatchTaskEditorProps {
  task: ExecutionTask;
  gbpConnected: boolean;
  actions: PlanTaskActions;
  attribution?: ActionAttribution;
  context: PlanBatchTaskEditorContext;
  onTaskCompleted?: () => void;
}

function BatchTaskHeader({ task }: { task: ExecutionTask }) {
  const stepNumber = resolvePlanStepNumber(task);

  return (
    <div className="mb-3 space-y-1">
      {stepNumber != null && (
        <p className="text-xs font-medium text-[#80868b]">
          From plan step {stepNumber}
          {typeof task.payload.gbpStepTitle === "string"
            ? ` — ${task.payload.gbpStepTitle}`
            : ""}
        </p>
      )}
      <h3 className="text-base font-semibold text-[#202124]">{task.title}</h3>
    </div>
  );
}

function isPlaceActionEditorTask(task: ExecutionTask): boolean {
  return (
    task.type === "gbp_place_action" &&
    (task.payload.requiresPlaceActionInput === true ||
      Array.isArray(task.payload.placeActionTypes))
  );
}

function attributeEditorHasContent(task: ExecutionTask): boolean {
  if (task.payload.requiresUriInput === true) return true;
  const attributes = task.payload.attributes;
  return Array.isArray(attributes) && attributes.length > 0;
}

export default function PlanBatchTaskEditor({
  task,
  gbpConnected,
  actions,
  attribution,
  context,
  onTaskCompleted,
}: PlanBatchTaskEditorProps) {
  const planContext = task.payload.planContext as PlanStepContext | undefined;
  const planBullets = Array.isArray(task.payload.planBullets)
    ? (task.payload.planBullets as string[])
    : undefined;

  if (task.type === "gbp_hours") {
    return (
      <div>
        <BatchTaskHeader task={task} />
        <PlanStepHours task={task} gbpConnected={gbpConnected} actions={actions} />
      </div>
    );
  }

  if (task.type === "gbp_attributes" && attributeEditorHasContent(task)) {
    return (
      <div>
        <BatchTaskHeader task={task} />
        <PlanStepAttributes
          task={task}
          gbpConnected={gbpConnected}
          actions={actions}
          coverage={context.attributeCoverage}
          businessPhone={context.businessPhone}
          businessWebsite={context.businessWebsite}
        />
      </div>
    );
  }

  if (isPlaceActionEditorTask(task)) {
    return (
      <div>
        <BatchTaskHeader task={task} />
        <PlanStepPlaceActions
          task={task}
          gbpConnected={gbpConnected}
          actions={actions}
          coverage={context.placeActionCoverage}
          configuredLinks={context.placeActionLinks}
        />
      </div>
    );
  }

  if (task.type === "gbp_photo") {
    return (
      <div>
        <BatchTaskHeader task={task} />
        <PlanStepPhotos
          tasks={[task]}
          gbpConnected={gbpConnected}
          actions={actions}
          mediaCoverage={context.mediaCoverage}
        />
      </div>
    );
  }

  if (task.type === "gbp_video") {
    return (
      <div>
        <BatchTaskHeader task={task} />
        <PlanStepVideos
          tasks={[task]}
          gbpConnected={gbpConnected}
          actions={actions}
        />
      </div>
    );
  }

  if (task.type === "review_request") {
    return (
      <div>
        <BatchTaskHeader task={task} />
        <ReviewRequestPanel
          businessName={context.businessName ?? "your business"}
          reviewUrl={context.reviewUrl}
          executionTaskId={task.id}
          planContext={planContext}
          planBullets={planBullets}
          initialFocusKeyword={context.initialFocusKeyword}
          onSent={() => onTaskCompleted?.()}
          canSkip={task.status === "pending_approval"}
          onSkip={() => void actions.rejectTask(task.id)}
          skipLoading={actions.loadingTaskId === task.id}
        />
      </div>
    );
  }

  if (task.type === "review_dispute") {
    return (
      <div>
        <BatchTaskHeader task={task} />
        <ReviewDisputePanel
          tasks={[task]}
          actions={actions}
          onDisputeUpdated={() => onTaskCompleted?.()}
        />
      </div>
    );
  }

  return (
    <PlanStepTaskRow
      task={task}
      gbpConnected={gbpConnected}
      actions={actions}
      attribution={attribution}
    />
  );
}
