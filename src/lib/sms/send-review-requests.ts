import type { ClientConfig } from "@/audit/types";
import {
  getCustomersByIds,
  getEligibleCustomers,
  logSmsMessage,
  markCustomersReviewRequested,
} from "@/lib/customers/storage";
import {
  getCustomersByIdsAdmin,
  logSmsMessageAdmin,
  markCustomersReviewRequestedAdmin,
} from "@/lib/customers/storage-admin";
import type { CustomerRecord } from "@/lib/customers/types";
import { personalizeReviewRequestSms } from "@/lib/sms/personalize";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { isTwilioConfigured, sendSms } from "@/lib/sms/twilio";

export interface SendReviewRequestsInput {
  userId: string;
  business: ClientConfig;
  template: string;
  customerIds?: string[];
  batchSize?: number;
  executionTaskId?: string;
  dryRun?: boolean;
  /** Use service-role client (for inbound webhooks without a user session). */
  serviceRole?: boolean;
}

export interface SendReviewRequestsResult {
  sent: number;
  failed: number;
  skipped: number;
  simulated: boolean;
  reviewUrl: string | null;
  messages: Array<{
    customerId: string;
    phone: string;
    body: string;
    status: "sent" | "failed" | "skipped" | "simulated";
    error?: string;
  }>;
}

function resolveReviewUrl(business: ClientConfig): string | null {
  const address = [
    business.location.address,
    business.location.city,
    business.location.state,
    business.location.zip,
  ]
    .filter(Boolean)
    .join(", ");

  return googleReviewUrlForBusiness({
    placeId: business.gbpPlaceId,
    mapsUrl: business.gbpMapsUrl,
    name: business.name,
    address,
  });
}

async function resolveCustomers(
  userId: string,
  businessId: string,
  customerIds?: string[],
  batchSize = 15,
  serviceRole = false
): Promise<CustomerRecord[]> {
  if (customerIds && customerIds.length > 0) {
    if (serviceRole) return getCustomersByIdsAdmin(businessId, customerIds);
    return getCustomersByIds(userId, businessId, customerIds);
  }
  return getEligibleCustomers(userId, businessId, batchSize);
}

export async function sendReviewRequests(
  input: SendReviewRequestsInput
): Promise<SendReviewRequestsResult> {
  const businessId = input.business.businessId;
  if (!businessId) {
    throw new Error("Business ID is required");
  }

  const reviewUrl = resolveReviewUrl(input.business);
  if (!reviewUrl) {
    throw new Error(
      "No Google review link available. Connect your Google Business Profile or add a Place ID in settings."
    );
  }

  const customers = await resolveCustomers(
    input.userId,
    businessId,
    input.customerIds,
    input.batchSize ?? 15,
    input.serviceRole
  );

  const result: SendReviewRequestsResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    simulated: !isTwilioConfigured() && !input.dryRun,
    reviewUrl,
    messages: [],
  };

  const sentCustomerIds: string[] = [];

  for (const customer of customers) {
    if (customer.opted_out) {
      result.skipped++;
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body: "",
        status: "skipped",
        error: "Customer opted out",
      });
      continue;
    }

    const body = personalizeReviewRequestSms({
      template: input.template,
      customer,
      businessName: input.business.name,
      reviewUrl,
    });

    if (input.dryRun) {
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "simulated",
      });
      continue;
    }

    if (!isTwilioConfigured()) {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        toPhone: customer.phone,
        body,
        status: "simulated",
      });
      sentCustomerIds.push(customer.id);
      result.sent++;
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "simulated",
      });
      continue;
    }

    const sms = await sendSms(customer.phone, body);

    if (sms.success) {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        toPhone: sms.to,
        body,
        status: "sent",
        providerSid: sms.sid,
      });
      sentCustomerIds.push(customer.id);
      result.sent++;
      result.messages.push({
        customerId: customer.id,
        phone: sms.to,
        body,
        status: "sent",
      });
    } else {
      const logMessage = input.serviceRole ? logSmsMessageAdmin : logSmsMessage;
      await logMessage(input.userId, {
        businessId,
        customerId: customer.id,
        executionTaskId: input.executionTaskId,
        toPhone: customer.phone,
        body,
        status: "failed",
        errorMessage: sms.error,
      });
      result.failed++;
      result.messages.push({
        customerId: customer.id,
        phone: customer.phone,
        body,
        status: "failed",
        error: sms.error,
      });
    }
  }

  if (!input.dryRun && sentCustomerIds.length > 0) {
    if (input.serviceRole) {
      await markCustomersReviewRequestedAdmin(businessId, sentCustomerIds);
    } else {
      await markCustomersReviewRequested(input.userId, businessId, sentCustomerIds);
    }
  }

  return result;
}
