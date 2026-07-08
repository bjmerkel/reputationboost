import type { ExecutionTask, FullAuditPayload, GapFlag } from "@/audit/types";
import { buildPathToHealthy } from "@/audit/phase2/path-to-healthy";
import { pendingBatchTasks } from "@/lib/execution/pending-tasks";
import { getPendingApprovalCounts } from "@/lib/execution/pending-counts";
import { getGoogleDiffFields } from "@/lib/google/gbp-update-helpers";
import {
  AT_WORK_PHOTO_GAP_DESCRIPTION,
  AT_WORK_PHOTO_GAP_TITLE,
  AT_WORK_PHOTO_PLAN_STEP,
} from "@/lib/google/gbp-media-coverage";

export type PlaybookStage = "setup" | "launch" | "execute" | "grow" | "maintain";

export type PlaybookActionKind =
  | "connect_gbp"
  | "run_audit"
  | "review_approvals"
  | "open_plan"
  | "open_report"
  | "open_map"
  | "open_settings_roi"
  | "open_settings_permissions"
  | "refresh_audit"
  | "open_results";

export interface PlaybookItem {
  id: string;
  stage: PlaybookStage;
  title: string;
  description: string;
  why: string;
  priority: number;
  status: "pending" | "done";
  action: PlaybookActionKind;
  href?: string;
  planStepNumber?: number;
  estimatedMinutes?: number;
}

export interface ProductPlaybook {
  stage: PlaybookStage;
  stageLabel: string;
  stageDescription: string;
  progressPercent: number;
  items: PlaybookItem[];
  nextItem: PlaybookItem | null;
  pendingCount: number;
  completedCount: number;
}

export interface PlaybookInput {
  gbpConnected: boolean;
  businessId?: string;
  audit: FullAuditPayload | null;
  tasks: ExecutionTask[];
  avgCustomerValue?: number | null;
  dismissedTips?: string[];
}

const STAGE_META: Record<
  PlaybookStage,
  { label: string; description: string }
> = {
  setup: {
    label: "Get set up",
    description: "Connect your profile and tell us about your business.",
  },
  launch: {
    label: "See where you stand",
    description: "Run your first audit and learn how to read your dashboard.",
  },
  execute: {
    label: "Take action",
    description: "Approve plan steps and publish changes to Google.",
  },
  grow: {
    label: "Close the gaps",
    description: "Finish your plan and strengthen weak areas on the map.",
  },
  maintain: {
    label: "Stay on top",
    description: "Refresh monthly, track progress, and keep momentum.",
  },
};

const PRIORITY = {
  critical: 0,
  high: 10,
  medium: 20,
  low: 30,
  habit: 40,
} as const;

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function topOpenGap(gaps: GapFlag[]): GapFlag | null {
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return (
    [...gaps]
      .filter((g) => g.priority === "P0" || g.priority === "P1")
      .sort((a, b) => order[a.priority] - order[b.priority])[0] ?? null
  );
}

function inferStage(input: PlaybookInput, pendingCount: number): PlaybookStage {
  if (!input.gbpConnected) return "setup";
  if (!input.audit) return "launch";
  if (pendingCount > 0) return "execute";

  const score = input.audit.strategy?.scores.overall ?? 0;
  const daysOld = daysSince(input.audit.completedAt);
  const openTasks = input.tasks.filter(
    (t) =>
      t.status === "pending_approval" ||
      t.status === "approved" ||
      t.status === "scheduled"
  );
  const planComplete = input.tasks.length === 0 || openTasks.length === 0;

  if (score < 70 || !planComplete) return "grow";
  if (daysOld >= 25) return "maintain";
  return "maintain";
}

export function buildProductPlaybook(input: PlaybookInput): ProductPlaybook {
  const dismissed = new Set(input.dismissedTips ?? []);
  const items: PlaybookItem[] = [];
  const pendingCounts = getPendingApprovalCounts(input.tasks);
  const batchPending = pendingBatchTasks(input.tasks);
  const planPendingCount = pendingCounts.total;
  const reviewPending = pendingCounts.reviewReplies;
  const unrespondedNegative = input.audit?.reviews.unrespondedNegative ?? 0;
  const auditAgeDays = daysSince(input.audit?.completedAt);
  const overallScore = input.audit?.strategy?.scores.overall ?? null;
  const gaps = input.audit?.strategy?.gaps ?? [];
  const topGap = topOpenGap(gaps);
  const path = input.audit
    ? buildPathToHealthy(input.audit, null, {
        avgCustomerValue: input.avgCustomerValue,
      })
    : null;
  const googleDiffFields = input.audit ? getGoogleDiffFields(input.audit) : [];

  const onboardHref = input.businessId
    ? `/platform/onboard?businessId=${input.businessId}`
    : "/platform/onboard";

  items.push({
    id: "connect-gbp",
    stage: "setup",
    title: "Connect Google Business Profile",
    description: "Link the listing you manage so we can pull live data and publish changes.",
    why: "Without GBP access, audits and one-click publishing are limited.",
    priority: PRIORITY.critical,
    status: input.gbpConnected ? "done" : "pending",
    action: "connect_gbp",
    href: onboardHref,
    estimatedMinutes: 3,
  });

  items.push({
    id: "set-roi",
    stage: "setup",
    title: "Set your average customer value",
    description: "Helps estimate revenue impact for each improvement on your plan.",
    why: "ROI estimates make it easier to prioritize high-value actions.",
    priority: PRIORITY.medium,
    status: input.avgCustomerValue != null && input.avgCustomerValue > 0 ? "done" : "pending",
    action: "open_settings_roi",
    href: "/platform/settings",
    estimatedMinutes: 1,
  });

  items.push({
    id: "run-first-audit",
    stage: "launch",
    title: "Run your first full audit",
    description: "Scan your listing, rankings, competitors, and build your optimization plan.",
    why: "Everything in the dashboard — map, plan, and report — starts here.",
    priority: PRIORITY.critical,
    status: input.audit ? "done" : "pending",
    action: "run_audit",
    estimatedMinutes: 2,
  });

  items.push({
    id: "read-report",
    stage: "launch",
    title: "Review your health report",
    description: "See your Reputation Boost Score, what's working, and what needs attention.",
    why: "The report tab is your monthly snapshot of listing strength.",
    priority: PRIORITY.high,
    status: !input.audit ? "pending" : dismissed.has("read-report") ? "done" : "pending",
    action: "open_report",
    estimatedMinutes: 3,
  });

  items.push({
    id: "explore-map",
    stage: "launch",
    title: "Explore your ranking map",
    description: "Switch keywords, read the heatmap, and tap weak areas to see who outranks you.",
    why: "The map shows where you win and lose local searches — not just at your address.",
    priority: PRIORITY.high,
    status: !input.audit ? "pending" : dismissed.has("explore-map") ? "done" : "pending",
    action: "open_map",
    estimatedMinutes: 4,
  });

  items.push({
    id: "approve-plan",
    stage: "execute",
    title:
      batchPending.length > 0
        ? `Approve ${batchPending.length} plan update${batchPending.length === 1 ? "" : "s"}`
        : pendingCounts.generating > 0
          ? `${pendingCounts.generating} photo${pendingCounts.generating === 1 ? "" : "s"} generating in Plan`
          : "Work through your optimization plan",
    description:
      batchPending.length > 0
        ? "Review AI-drafted posts, profile edits, and media — then publish to Google."
        : pendingCounts.generating > 0
          ? "Open Plan to finish generating photo previews before you can approve them."
          : "Open Plan to see the next steps tailored to your audit.",
    why: "Approved changes go live on your Google Business Profile automatically.",
    priority: PRIORITY.critical,
    status: planPendingCount === 0 && input.audit ? "done" : "pending",
    action: batchPending.length > 0 ? "review_approvals" : "open_plan",
    estimatedMinutes: batchPending.length > 0 ? Math.min(15, batchPending.length * 2) : 5,
  });

  if (googleDiffFields.length > 0) {
    items.push({
      id: "google-updates",
      stage: "execute",
      title: `Resolve ${googleDiffFields.length} Google profile conflict${googleDiffFields.length === 1 ? "" : "s"}`,
      description: `Google recommends changes to: ${googleDiffFields.map((field) => field.label).join(", ")}.`,
      why: "Accept or keep your version so customers see the profile you intend.",
      priority: PRIORITY.high,
      status: googleDiffFields.length === 0 ? "done" : "pending",
      action: "open_plan",
      estimatedMinutes: Math.max(3, googleDiffFields.length * 2),
    });
  }

  if (reviewPending > 0 || unrespondedNegative > 0) {
    items.push({
      id: "reply-reviews",
      stage: "execute",
      title:
        reviewPending > 0
          ? `Reply to ${reviewPending} review${reviewPending === 1 ? "" : "s"}`
          : `Address ${unrespondedNegative} negative review${unrespondedNegative === 1 ? "" : "s"}`,
      description: "Approve suggested replies or edit them before publishing to Google.",
      why: "Timely responses improve trust and can lift your local rankings.",
      priority: PRIORITY.high,
      status: reviewPending === 0 && unrespondedNegative === 0 ? "done" : "pending",
      action: reviewPending > 0 ? "review_approvals" : "open_plan",
      estimatedMinutes: Math.max(2, reviewPending * 2),
    });
  }

  const missingWorkPhotos = input.audit?.gbp.content.mediaCoverage?.hasAtWork === false;
  if (missingWorkPhotos && input.gbpConnected && input.audit) {
    items.push({
      id: "add-work-photos",
      stage: "execute",
      title: AT_WORK_PHOTO_GAP_TITLE,
      description: AT_WORK_PHOTO_GAP_DESCRIPTION,
      why: "Google highlights this on your profile completeness checklist — customers are twice as likely to interact with businesses that show their work.",
      priority: PRIORITY.high,
      status: "pending",
      action: "open_plan",
      planStepNumber: AT_WORK_PHOTO_PLAN_STEP,
      estimatedMinutes: 5,
    });
  }

  const performanceBlocked =
    input.audit != null &&
    (input.audit.gbp.performance.source !== "api" ||
      input.audit.gbp.performance.accessCheck?.severity === "warning");

  if (performanceBlocked) {
    items.push({
      id: "fix-permissions",
      stage: "execute",
      title: "Restore Google performance access",
      description: "Reconnect or grant permissions so calls, clicks, and search terms stay current.",
      why: "Performance data powers smarter priorities and ROI tracking.",
      priority: PRIORITY.high,
      status: "pending",
      action: "open_settings_permissions",
      href: "/platform/settings",
      estimatedMinutes: 3,
    });
  }

  if (topGap && input.audit) {
    items.push({
      id: `gap-${topGap.id}`,
      stage: "grow",
      title: topGap.title,
      description: topGap.description,
      why: `High-impact ${topGap.priority} gap — fixing this moves your score toward healthy (70+).`,
      priority: PRIORITY.medium,
      status: overallScore != null && overallScore >= 70 ? "done" : "pending",
      action: "open_plan",
      estimatedMinutes: 10,
    });
  } else if (path?.steps[0] && input.audit) {
    items.push({
      id: `path-${path.steps[0].id}`,
      stage: "grow",
      title: path.steps[0].title,
      description: "Next highest-impact step on your path to a healthy Reputation Boost Score.",
      why: path.alreadyHealthy
        ? "Your score is healthy — keep executing the plan to stay ahead."
        : `Projected score after key fixes: ${path.projectedScore}/100.`,
      priority: PRIORITY.medium,
      status: path.alreadyHealthy ? "done" : "pending",
      action: "open_plan",
      estimatedMinutes: 10,
    });
  }

  const weakCoverage =
    input.audit?.rankings.keywords.some((k) => {
      const grid = k.geoGrid ?? [];
      if (grid.length === 0) return false;
      const inPack = grid.filter((c) => c.inLocalPack).length;
      return inPack / grid.length < 0.5;
    }) ?? false;

  if (weakCoverage && input.audit) {
    items.push({
      id: "map-weak-zones",
      stage: "grow",
      title: "Target weak areas on the map",
      description: "Open Areas to improve (bottom-left on the map) and tap zones with low top-3 coverage.",
      why: "Geo gaps often mean lost calls in neighborhoods you already serve.",
      priority: PRIORITY.medium,
      status: dismissed.has("map-weak-zones") ? "done" : "pending",
      action: "open_map",
      estimatedMinutes: 5,
    });
  }

  items.push({
    id: "monthly-refresh",
    stage: "maintain",
    title: "Refresh your audit data",
    description:
      auditAgeDays >= 25
        ? `Last audit was ${auditAgeDays} days ago — run a fresh scan to update rankings and your plan.`
        : "Re-run monthly to catch competitor moves and update your optimization plan.",
    why: "Local rankings shift weekly. A fresh audit keeps your plan relevant.",
    priority: auditAgeDays >= 25 ? PRIORITY.high : PRIORITY.habit,
    status: input.audit && auditAgeDays < 25 ? "done" : input.audit ? "pending" : "pending",
    action: "refresh_audit",
    estimatedMinutes: 2,
  });

  if (input.audit?.strategy?.monthlyReport) {
    items.push({
      id: "monthly-report",
      stage: "maintain",
      title: "Read your monthly overview",
      description: "See calls, directions, clicks, and what to focus on next month.",
      why: "Monthly trends show whether your plan is paying off.",
      priority: PRIORITY.low,
      status: dismissed.has("monthly-report") ? "done" : "pending",
      action: "open_report",
      estimatedMinutes: 4,
    });
  }

  items.push({
    id: "track-results",
    stage: "maintain",
    title: "Check what's working",
    description: "Open Results to see attribution — which actions moved rankings and engagement.",
    why: "Double down on tactics that already drove measurable gains.",
    priority: PRIORITY.low,
    status: dismissed.has("track-results") ? "done" : "pending",
    action: "open_results",
    estimatedMinutes: 3,
  });

  const uniqueItems = items.filter(
    (item, index, arr) => arr.findIndex((x) => x.id === item.id) === index
  );

  const stage = inferStage(input, uniqueItems.filter((i) => i.status === "pending").length);
  const stageItems = uniqueItems.filter((i) => i.stage === stage);
  const relevantItems =
    stageItems.length > 0
      ? [
          ...stageItems,
          ...uniqueItems.filter((i) => i.stage !== stage && i.status === "pending"),
        ]
      : uniqueItems;

  const sorted = [...relevantItems].sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return a.priority - b.priority;
  });

  const pending = sorted.filter((i) => i.status === "pending");
  const completed = sorted.filter((i) => i.status === "done");
  const progressPercent =
    sorted.length > 0 ? Math.round((completed.length / sorted.length) * 100) : 0;

  return {
    stage,
    stageLabel: STAGE_META[stage].label,
    stageDescription: STAGE_META[stage].description,
    progressPercent,
    items: sorted,
    nextItem: pending[0] ?? null,
    pendingCount: pending.length,
    completedCount: completed.length,
  };
}

export function playbookTipDismissId(itemId: string): string {
  return itemId;
}
