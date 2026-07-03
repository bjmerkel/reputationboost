"use client";

export type AuditView = "report" | "reviews" | "strategy" | "data";

/** @deprecated Legacy views redirected to strategy */
export type LegacyAuditView = "photos" | "execute";

export const AUDIT_VIEWS: AuditView[] = ["report", "reviews", "strategy", "data"];

const LEGACY_VIEW_REDIRECTS: Record<LegacyAuditView, AuditView> = {
  photos: "strategy",
  execute: "strategy",
};

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
    title: "Home",
    subtitle: "Health, recent wins, and what needs you",
  },
  {
    id: "strategy",
    step: 2,
    title: "Plan",
    subtitle: "16-step checklist — approve and publish in one place",
  },
  {
    id: "reviews",
    step: 3,
    title: "Reviews",
    subtitle: "Sentiment, replies, and response queue",
  },
  {
    id: "data",
    step: 4,
    title: "Results",
    subtitle: "Plan changelog and measured outcomes",
  },
];

export function isAuditView(value: string | null): value is AuditView {
  return AUDIT_VIEWS.includes(value as AuditView);
}

export function normalizeAuditView(value: string | null): AuditView {
  if (!value) return "report";
  if (isAuditView(value)) return value;
  if (value in LEGACY_VIEW_REDIRECTS) {
    return LEGACY_VIEW_REDIRECTS[value as LegacyAuditView];
  }
  return "report";
}
