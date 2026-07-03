"use client";

export type AuditView = "report" | "strategy" | "execute" | "data";

export const AUDIT_VIEWS: AuditView[] = ["report", "strategy", "execute", "data"];

export interface AuditStoryStep {
  id: AuditView;
  step: number;
  title: string;
  subtitle: string;
}

export const AUDIT_STORY_STEPS: AuditStoryStep[] = [
  {
    id: "report",
    step: 1,
    title: "Your Results",
    subtitle: "See what changed this month",
  },
  {
    id: "strategy",
    step: 2,
    title: "Your Plan",
        subtitle: "16-step GBP optimization report",
  },
  {
    id: "execute",
    step: 3,
    title: "Take Action",
    subtitle: "Approve & publish content",
  },
  {
    id: "data",
    step: 4,
    title: "Deep Dive",
    subtitle: "Full audit breakdown",
  },
];

export function isAuditView(value: string | null): value is AuditView {
  return AUDIT_VIEWS.includes(value as AuditView);
}
