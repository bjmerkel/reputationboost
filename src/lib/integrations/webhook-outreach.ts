import type { FullAuditPayload } from "@/audit/types";
import type { CustomerRecord } from "@/lib/customers/types";
import { generateReviewRequestEmail } from "@/lib/llm/review-request-email";
import { generateReviewRequestMessage } from "@/lib/llm/review-request-sms";
import type { GeoReviewPromptOptions } from "@/lib/llm/review-request-sms";
import type { OutreachChannel } from "@/lib/review-requests/channel";
import { getOutreachTargets } from "@/lib/customers/outreach-targets";

export interface WebhookReviewRequestContent {
  smsTemplate: string;
  emailTemplate: string;
  subject: string;
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

async function buildSmsTemplate(input: {
  businessName: string;
  audit: FullAuditPayload | null;
  customer: CustomerRecord;
  focusKeyword?: string | null;
  geo?: GeoReviewPromptOptions;
}): Promise<string> {
  if (input.audit) {
    return generateReviewRequestMessage(
      input.audit,
      input.customer,
      input.focusKeyword,
      input.geo
    );
  }
  return buildDefaultSmsTemplate(input.businessName);
}

async function buildEmailTemplate(input: {
  businessName: string;
  audit: FullAuditPayload | null;
  customer: CustomerRecord;
  focusKeyword?: string | null;
  geo?: GeoReviewPromptOptions;
}): Promise<{ subject: string; body: string }> {
  if (input.audit) {
    const draft = await generateReviewRequestEmail(
      input.audit,
      input.customer,
      input.focusKeyword,
      input.geo
    );
    return { subject: draft.subject, body: draft.body };
  }
  return buildDefaultEmailContent(input.businessName);
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
    const smsTemplate = buildPrivateFeedbackTemplate(input.businessName);
    return {
      smsTemplate,
      emailTemplate: smsTemplate,
      subject: `Message from ${input.businessName}`,
    };
  }

  const targets = getOutreachTargets(input.channel, input.customer);
  const base = {
    businessName: input.businessName,
    audit: input.audit,
    customer: input.customer,
    focusKeyword: input.focusKeyword,
    geo: input.geo,
  };

  const [smsTemplate, emailDraft] = await Promise.all([
    targets.sms || input.channel === "sms" || input.channel === "auto"
      ? buildSmsTemplate(base)
      : Promise.resolve(buildDefaultSmsTemplate(input.businessName)),
    targets.email || input.channel === "email" || input.channel === "auto"
      ? buildEmailTemplate(base)
      : Promise.resolve(buildDefaultEmailContent(input.businessName)),
  ]);

  return {
    smsTemplate,
    emailTemplate: emailDraft.body,
    subject: emailDraft.subject,
  };
}

export {
  canDeliverWebhookOutreach,
  resolveWebhookOutreachChannel,
} from "@/lib/customers/outreach-targets";
