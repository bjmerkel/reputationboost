export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  noteTemplate?: string;
}

export const INTERVENTION_PLAYBOOK: PlaybookStep[] = [
  {
    id: "review_signals",
    title: "Review health signals",
    description: "Check churn risk, score trend, and GBP connection status before reaching out.",
  },
  {
    id: "log_contact",
    title: "Log outreach contact",
    description: "Record what you discussed and any commitments made.",
    noteTemplate:
      "[Outreach] Contacted user — discussed account health and next steps. Follow-up: ",
  },
  {
    id: "resolve_blockers",
    title: "Resolve blockers",
    description: "Use manage-as-user to fix GBP disconnects, approve pending tasks, or complete onboarding.",
  },
  {
    id: "schedule_followup",
    title: "Schedule follow-up",
    description: "Set a reminder to check back if the user doesn't improve within 7 days.",
    noteTemplate: "[Follow-up] Check back by — reason: ",
  },
];

export function playbookStepLabel(stepId: string): string {
  return INTERVENTION_PLAYBOOK.find((step) => step.id === stepId)?.title ?? stepId;
}
