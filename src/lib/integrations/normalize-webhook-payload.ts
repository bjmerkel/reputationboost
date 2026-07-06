import type { WebhookPayload } from "./webhook-types";

export const OPT_OUT_EVENT_TYPES = new Set([
  "customer.opted_out",
  "sms.opt_out",
  "do_not_contact",
  "customer.unsubscribed",
  "sms.stop",
]);

export const OPT_IN_EVENT_TYPES = new Set(["customer.opted_in", "sms.opt_in"]);

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return undefined;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function resolveOptedOut(
  event: string,
  explicit: boolean | undefined
): boolean | undefined {
  const normalized = event.trim().toLowerCase();
  if (OPT_OUT_EVENT_TYPES.has(normalized)) return true;
  if (OPT_IN_EVENT_TYPES.has(normalized)) return false;
  return explicit;
}

export function isOptOutEvent(eventType: string): boolean {
  return OPT_OUT_EVENT_TYPES.has(eventType.trim().toLowerCase());
}

export function normalizeWebhookPayload(data: unknown): WebhookPayload {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Webhook body must be a JSON object");
  }

  const record = data as Record<string, unknown>;
  const event = readString(record, ["event", "event_type", "eventType", "type"]);
  const phone = readString(record, ["phone", "phoneNumber", "phone_number", "mobile", "cell"]);

  if (!event) throw new Error("Missing required field: event");
  if (!phone) throw new Error("Missing required field: phone");

  const fullName = readString(record, ["name", "fullName", "full_name", "customerName"]);
  const firstName = readString(record, ["firstName", "first_name", "given_name"]);
  const lastName = readString(record, ["lastName", "last_name", "family_name", "surname"]);
  const parsedName = fullName ? splitName(fullName) : { firstName: "", lastName: "" };
  const explicitOptedOut = readBoolean(record, [
    "optedOut",
    "opted_out",
    "doNotContact",
    "do_not_contact",
  ]);

  return {
    event,
    phone,
    firstName: firstName ?? parsedName.firstName,
    lastName: lastName ?? parsedName.lastName,
    name: fullName,
    email: readString(record, ["email", "email_address"]),
    service: readString(record, ["service", "serviceNotes", "service_notes", "job", "jobTitle", "job_title"]),
    serviceDate: readString(record, ["serviceDate", "service_date", "completedAt", "completed_at", "date"]),
    externalId: readString(record, ["externalId", "external_id", "jobId", "job_id", "invoiceId", "invoice_id"]),
    source: readString(record, ["source", "integration", "crm"]) ?? "webhook",
    sendReviewRequest: readBoolean(record, ["sendReviewRequest", "send_review_request"]),
    optedOut: resolveOptedOut(event, explicitOptedOut),
  };
}

export function isTriggerEvent(eventType: string, triggerEvents: string[]): boolean {
  const normalized = eventType.trim().toLowerCase();
  return triggerEvents.some((event) => event.trim().toLowerCase() === normalized);
}
