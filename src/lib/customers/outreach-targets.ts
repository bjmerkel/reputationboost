import type { CustomerRecord } from "@/lib/customers/types";
import type { OutreachChannel } from "@/lib/review-requests/channel";
import { normalizeEmail } from "@/lib/email/resend";
import { normalizePhoneE164 } from "@/lib/sms/phone";

export interface OutreachTargets {
  email: boolean;
  sms: boolean;
}

export function customerHasEmail(customer: Pick<CustomerRecord, "email">): boolean {
  return Boolean(normalizeEmail(customer.email ?? ""));
}

export function customerHasSms(customer: Pick<CustomerRecord, "phone">): boolean {
  return Boolean(customer.phone && normalizePhoneE164(customer.phone));
}

export function getOutreachTargets(
  channel: OutreachChannel,
  customer: Pick<CustomerRecord, "phone" | "email">
): OutreachTargets {
  const hasEmail = customerHasEmail(customer);
  const hasSms = customerHasSms(customer);

  if (channel === "email") return { email: hasEmail, sms: false };
  if (channel === "sms") return { email: false, sms: hasSms };
  return { email: hasEmail, sms: hasSms };
}

/** @deprecated Use getOutreachTargets instead. */
export function resolveWebhookOutreachChannel(
  channel: OutreachChannel,
  customer: Pick<CustomerRecord, "phone" | "email">
): OutreachChannel {
  const targets = getOutreachTargets(channel, customer);
  if (targets.email && targets.sms) return "auto";
  if (targets.email) return "email";
  return "sms";
}

export function canDeliverWebhookOutreach(
  channel: OutreachChannel,
  customer: Pick<CustomerRecord, "phone" | "email">
): boolean {
  const targets = getOutreachTargets(channel, customer);
  return targets.email || targets.sms;
}
