export const DEFAULT_WEBHOOK_TRIGGER_EVENTS = ["job.completed", "invoice.paid"] as const;

export type WebhookEventType =
  | "job.completed"
  | "invoice.paid"
  | "appointment.completed"
  | "customer.created"
  | string;

export interface WebhookPayload {
  event: WebhookEventType;
  phone: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  service?: string;
  serviceDate?: string;
  externalId?: string;
  source?: string;
  sendReviewRequest?: boolean;
  optedOut?: boolean;
}

export interface WebhookBusinessSettings {
  businessId: string;
  userId: string;
  webhookToken: string;
  autoSend: boolean;
  delayHours: number;
  triggerEvents: string[];
}

export interface WebhookProcessResult {
  ok: true;
  customerId: string;
  eventId: string;
  eventType: string;
  reviewRequestSent: boolean;
  reviewRequestScheduled?: boolean;
  scheduledAt?: string;
  scheduledSmsId?: string;
  auditHasReviewGap?: boolean;
  reviewRequestSkippedReason?: string;
}
