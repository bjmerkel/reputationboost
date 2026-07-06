export type GbpEventType =
  | "GOOGLE_UPDATE"
  | "NEW_REVIEW"
  | "UPDATED_REVIEW"
  | "NEW_CUSTOMER_MEDIA"
  | "DUPLICATE_LOCATION"
  | "VOICE_OF_MERCHANT_UPDATED"
  | "REJECTED_REPLY"
  | "PENDING_REPLY"
  | "NEGATIVE_REVIEW"
  | "UNRESPONDED_NEGATIVE"
  | "REJECTED_POST"
  | "CUSTOMER_MEDIA_DOMINANCE";

export type GbpEventSeverity = "info" | "warning" | "critical";
export type GbpEventSource = "pubsub" | "nightly" | "audit";

export interface GbpEvent {
  id: string;
  businessId: string;
  userId: string;
  eventType: GbpEventType;
  severity: GbpEventSeverity;
  source: GbpEventSource;
  title: string;
  message: string;
  externalId?: string | null;
  payload?: Record<string, unknown>;
  planStepNumber?: number | null;
  planScrollTarget?: "google-updates" | null;
  detectedAt: string;
  acknowledgedAt?: string | null;
  createdAt: string;
}

export interface RecordGbpEventInput {
  businessId: string;
  userId: string;
  eventType: GbpEventType;
  severity?: GbpEventSeverity;
  source: GbpEventSource;
  title: string;
  message: string;
  externalId?: string;
  payload?: Record<string, unknown>;
  planStepNumber?: number;
  planScrollTarget?: "google-updates";
  detectedAt?: string;
}
