import type { OutreachChannel } from "@/lib/review-requests/channel";
import { sendEmailReviewRequests } from "@/lib/email/send-review-requests";
import { sendReviewRequests } from "@/lib/sms/send-review-requests";
import type { SendReviewRequestsInput, SendReviewRequestsResult } from "@/lib/sms/send-review-requests";
import type { SendEmailReviewRequestsInput, SendEmailReviewRequestsResult } from "@/lib/email/send-review-requests";
import { normalizeEmail } from "@/lib/email/resend";
import { normalizePhoneE164 } from "@/lib/sms/phone";
import type { CustomerRecord } from "@/lib/customers/types";

export type { OutreachChannel } from "@/lib/review-requests/channel";

export interface SendOutreachReviewRequestsInput extends SendReviewRequestsInput {
  channel?: OutreachChannel;
  subjectTemplate?: string;
}

export interface SendOutreachReviewRequestsResult {
  channel: OutreachChannel;
  sent: number;
  failed: number;
  skipped: number;
  simulated: boolean;
  keywordFilterApplied: boolean;
  geoFilterApplied: boolean;
  reviewUrl: string | null;
  sms?: SendReviewRequestsResult;
  email?: SendEmailReviewRequestsResult;
}

function canReachBySms(customer: CustomerRecord): boolean {
  return Boolean(normalizePhoneE164(customer.phone));
}

function canReachByEmail(customer: CustomerRecord): boolean {
  return Boolean(normalizeEmail(customer.email ?? ""));
}

export async function sendOutreachReviewRequests(
  input: SendOutreachReviewRequestsInput
): Promise<SendOutreachReviewRequestsResult> {
  const channel = input.channel ?? "sms";

  if (channel === "email") {
    if (!input.subjectTemplate?.trim()) {
      throw new Error("Email subject is required");
    }
    const email = await sendEmailReviewRequests({
      userId: input.userId,
      business: input.business,
      subjectTemplate: input.subjectTemplate.trim(),
      bodyTemplate: input.template,
      customerIds: input.customerIds,
      batchSize: input.batchSize,
      executionTaskId: input.executionTaskId,
      dryRun: input.dryRun,
      serviceRole: input.serviceRole,
      manualSend: input.manualSend,
      focusKeyword: input.focusKeyword,
      auditHasReviewGap: input.auditHasReviewGap,
      reviewUrlOverride: input.reviewUrlOverride,
      geoRouting: input.geoRouting,
      enableGeoRouting: input.enableGeoRouting,
    });

    return {
      channel: "email",
      sent: email.sent,
      failed: email.failed,
      skipped: email.skipped,
      simulated: email.simulated,
      keywordFilterApplied: email.keywordFilterApplied,
      geoFilterApplied: email.geoFilterApplied,
      reviewUrl: email.reviewUrl,
      email,
    };
  }

  if (channel === "auto") {
    const businessId = input.business.businessId!;
    const batchSize = input.batchSize ?? 15;
    const { getEligibleCustomers } = await import("@/lib/customers/storage");
    const { getEligibleCustomersAdmin } = await import("@/lib/customers/storage-admin");

    let pool = input.serviceRole
      ? await getEligibleCustomersAdmin(businessId, batchSize * 4)
      : await getEligibleCustomers(input.userId, businessId, batchSize * 4);

    if (input.customerIds?.length) {
      const { getCustomersByIds } = await import("@/lib/customers/storage");
      const { getCustomersByIdsAdmin } = await import("@/lib/customers/storage-admin");
      pool = input.serviceRole
        ? await getCustomersByIdsAdmin(businessId, input.customerIds)
        : await getCustomersByIds(input.userId, businessId, input.customerIds);
    }

    const emailIds: string[] = [];
    const smsIds: string[] = [];
    for (const customer of pool) {
      if (emailIds.length + smsIds.length >= batchSize) break;
      if (canReachByEmail(customer)) emailIds.push(customer.id);
      else if (canReachBySms(customer)) smsIds.push(customer.id);
    }

    const smsInput: SendReviewRequestsInput = { ...input };
    const emailInput: SendEmailReviewRequestsInput = {
      userId: input.userId,
      business: input.business,
      subjectTemplate: input.subjectTemplate?.trim() || "How was your experience with [BUSINESS]?",
      bodyTemplate: input.template,
      batchSize,
      executionTaskId: input.executionTaskId,
      dryRun: input.dryRun,
      serviceRole: input.serviceRole,
      manualSend: input.manualSend,
      focusKeyword: input.focusKeyword,
      auditHasReviewGap: input.auditHasReviewGap,
      reviewUrlOverride: input.reviewUrlOverride,
      geoRouting: input.geoRouting,
      enableGeoRouting: input.enableGeoRouting,
    };

    const [email, sms] = await Promise.all([
      emailIds.length > 0
        ? sendEmailReviewRequests({ ...emailInput, customerIds: emailIds })
        : Promise.resolve(null),
      smsIds.length > 0
        ? sendReviewRequests({ ...smsInput, customerIds: smsIds })
        : Promise.resolve(null),
    ]);

    return {
      channel: "auto",
      sent: (email?.sent ?? 0) + (sms?.sent ?? 0),
      failed: (email?.failed ?? 0) + (sms?.failed ?? 0),
      skipped: (email?.skipped ?? 0) + (sms?.skipped ?? 0),
      simulated: Boolean(email?.simulated || sms?.simulated),
      keywordFilterApplied: Boolean(email?.keywordFilterApplied || sms?.keywordFilterApplied),
      geoFilterApplied: Boolean(email?.geoFilterApplied || sms?.geoFilterApplied),
      reviewUrl: email?.reviewUrl ?? sms?.reviewUrl ?? null,
      email: email ?? undefined,
      sms: sms ?? undefined,
    };
  }

  const sms = await sendReviewRequests(input);
  return {
    channel: "sms",
    sent: sms.sent,
    failed: sms.failed,
    skipped: sms.skipped,
    simulated: sms.simulated,
    keywordFilterApplied: sms.keywordFilterApplied,
    geoFilterApplied: sms.geoFilterApplied,
    reviewUrl: sms.reviewUrl,
    sms,
  };
}
