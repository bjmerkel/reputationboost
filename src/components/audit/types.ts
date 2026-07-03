"use client";

export type AuditView = "report" | "strategy" | "photos" | "execute" | "data";

export const AUDIT_VIEWS: AuditView[] = ["report", "strategy", "photos", "execute", "data"];

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
    subtitle: "KPI targets & 16-step GBP playbook",
  },
  {
    id: "photos",
    step: 3,
    title: "Photos",
    subtitle: "AI-generated shots — upload in one click",
  },
  {
    id: "execute",
    step: 4,
    title: "Take Action",
    subtitle: "Approve & publish everything else",
  },
  {
    id: "data",
    step: 5,
    title: "Deep Dive",
    subtitle: "Full audit breakdown",
  },
];

export function isAuditView(value: string | null): value is AuditView {
  return AUDIT_VIEWS.includes(value as AuditView);
}
