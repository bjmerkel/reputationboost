"use client";

export type AuditView = "report" | "strategy" | "data";

/** @deprecated Legacy views redirected to current tabs */
export type LegacyAuditView = "photos" | "execute" | "reviews";

export const AUDIT_VIEWS: AuditView[] = ["report", "strategy", "data"];

const LEGACY_VIEW_REDIRECTS: Record<LegacyAuditView, AuditView> = {
  photos: "strategy",
  execute: "strategy",
  reviews: "report",
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
    subtitle: "15-step checklist — approve and publish in one place",
  },
  {
    id: "data",
    step: 3,
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
