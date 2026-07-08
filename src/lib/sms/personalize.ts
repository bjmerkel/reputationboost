import type { CustomerRecord } from "@/lib/customers/types";
import { substituteReviewLink } from "./review-link";

export interface PersonalizeSmsOptions {
  template: string;
  customer: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">;
  businessName: string;
  reviewUrl: string;
}

export function customerDisplayName(
  customer: Pick<CustomerRecord, "first_name" | "last_name">
): string {
  const first = customer.first_name.trim();
  const last = customer.last_name.trim();
  if (first && last) return `${first} ${last}`;
  return first || last || "there";
}

export function customerFirstName(
  customer: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">
): string {
  return customer.first_name.trim() || customer.last_name.trim() || "there";
}

export function personalizeReviewRequestSms(options: PersonalizeSmsOptions): string {
  const { template, customer, businessName, reviewUrl } = options;
  const firstName = customerFirstName(customer);
  const service = customer.service_notes?.trim() || "your recent visit";

  return substituteReviewLink(ensureBusinessInTemplate(template, businessName), reviewUrl, {
    FIRST_NAME: firstName,
    NAME: customerDisplayName(customer),
    BUSINESS: businessName,
    SERVICE: service,
  });
}

/** Ensures the customer can tell who sent the text — via [BUSINESS] or the literal name. */
export function ensureBusinessInTemplate(template: string, businessName: string): string {
  const trimmedName = businessName.trim();
  if (!trimmedName) return template;
  if (template.includes("[BUSINESS]")) return template;
  if (template.toLowerCase().includes(trimmedName.toLowerCase())) return template;

  const greetingMatch = template.match(/^Hi \[FIRST_NAME\][!,]?\s*(.*)/i);
  if (greetingMatch) {
    const rest = greetingMatch[1];
    const restNormalized =
      rest.length > 0 ? rest.charAt(0).toLowerCase() + rest.slice(1) : rest;
    return `Hi [FIRST_NAME], thank you for choosing [BUSINESS]! ${restNormalized}`;
  }

  return `Hi from [BUSINESS]! ${template}`;
}

export function previewReviewRequestSms(options: {
  template: string;
  businessName: string;
  reviewUrl: string;
  customer?: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes"> | null;
  serviceFallback?: string | null;
}): string {
  const { template, businessName, reviewUrl, customer, serviceFallback } = options;
  const resolvedTemplate = ensureBusinessInTemplate(template, businessName);

  if (customer) {
    return personalizeReviewRequestSms({
      template: resolvedTemplate,
      customer,
      businessName,
      reviewUrl,
    });
  }

  return substituteReviewLink(resolvedTemplate, reviewUrl, {
    FIRST_NAME: "[FIRST_NAME]",
    NAME: "[NAME]",
    BUSINESS: businessName,
    SERVICE: serviceFallback?.trim() || "[SERVICE]",
  });
}
