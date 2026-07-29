import type { FullAuditPayload } from "@/audit/types";
import type { CustomerRecord } from "@/lib/customers/types";
import { generateReviewRequestEmail } from "@/lib/llm/review-request-email";
import { generateReviewRequestMessage } from "@/lib/llm/review-request-sms";
import type { OutreachChannel } from "@/lib/review-requests/channel";
import type { GeoReviewPromptOptions } from "@/lib/llm/review-request-sms";
import { normalizeEmail } from "@/lib/email/resend";
import { normalizePhoneE164 } from "@/lib/sms/phone";

export interface WebhookReviewRequestContent {
  channel: OutreachChannel;
  template: string;
  subject?: string;
}

function buildDefaultSmsTemplate(_businessName: string): string {
  return `Hi [FIRST_NAME]! Thanks for choosing [BUSINESS] for [SERVICE]. We'd love your feedback on Google — it helps neighbors find us: [REVIEW_LINK]`;
}

function buildDefaultEmailContent(businessName: string): { subject: string; body: string } {
  return {
    subject: "How was your experience with [BUSINESS]?",
    body: `Hi [FIRST_NAME],\n\nThank you for choosing [BUSINESS] for [SERVICE]. If your experience was great, would you take a moment to leave us a quick Google review?\n\n[REVIEW_LINK]\n\nThank you,\n[BUSINESS]`,
  };
}

export function resolveWebhookOutreachChannel(
  channel: OutreachChannel,
  customer: Pick<CustomerRecord, "phone" | "email">
): OutreachChannel {
  if (channel === "auto") {
    if (normalizeEmail(customer.email ?? "")) return "email";
    if (normalizePhoneE164(customer.phone)) return "sms";
    return "sms";
  }
  return channel;
}

export function canDeliverWebhookOutreach(
  channel: OutreachChannel,
  customer: Pick<CustomerRecord, "phone" | "email">
): boolean {
  const resolved = resolveWebhookOutreachChannel(channel, customer);
  if (resolved === "email") return Boolean(normalizeEmail(customer.email ?? ""));
  return Boolean(normalizePhoneE164(customer.phone));
}

export async function generateWebhookReviewRequestContent(input: {
  channel: OutreachChannel;
  businessName: string;
  audit: FullAuditPayload | null;
  customer: CustomerRecord;
  focusKeyword?: string | null;
  geo?: GeoReviewPromptOptions;
  usePrivateFeedback?: boolean;
}): Promise<WebhookReviewRequestContent> {
  if (input.usePrivateFeedback) {
    const { buildPrivateFeedbackTemplate } = await import("@/lib/sms/private-feedback");
    return {
      channel: "sms",
      template: buildPrivateFeedbackTemplate(input.businessName),
    };
  }

  const resolvedChannel = resolveWebhookOutreachChannel(input.channel, input.customer);

  if (resolvedChannel === "email") {
    if (input.audit) {
      const draft = await generateReviewRequestEmail(
        input.audit,
        input.customer,
        input.focusKeyword,
        input.geo
      );
      return {
        channel: "email",
        template: draft.body,
        subject: draft.subject,
      };
    }

    const fallback = buildDefaultEmailContent(input.businessName);
    return {
      channel: "email",
      template: fallback.body,
      subject: fallback.subject,
    };
  }

  const template = input.audit
    ? await generateReviewRequestMessage(
        input.audit,
        input.customer,
        input.focusKeyword,
        input.geo
      )
    : buildDefaultSmsTemplate(input.businessName);

  return {
    channel: "sms",
    template,
  };
}
