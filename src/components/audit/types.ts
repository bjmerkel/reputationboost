"use client";

export type AuditView = "report" | "reviews" | "strategy" | "photos" | "execute" | "data";

export const AUDIT_VIEWS: AuditView[] = [
  "report",
  "reviews",
  "strategy",
  "photos",
  "execute",
  "data",
];

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
    id: "reviews",
    step: 2,
    title: "Reviews",
    subtitle: "Sentiment, replies, and response queue",
  },
  {
    id: "strategy",
    step: 3,
    title: "Your Plan",
    subtitle: "KPI targets & 16-step GBP playbook",
  },
  {
    id: "photos",
    step: 4,
    title: "Photos",
    subtitle: "AI-generated shots — upload in one click",
  },
  {
    id: "execute",
    step: 5,
    title: "Take Action",
    subtitle: "Approve & publish everything else",
  },
  {
    id: "data",
    step: 6,
    title: "Deep Dive",
    subtitle: "Full audit breakdown",
  },
];

export function isAuditView(value: string | null): value is AuditView {
  return AUDIT_VIEWS.includes(value as AuditView);
}
