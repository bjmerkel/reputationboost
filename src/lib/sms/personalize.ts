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

  return substituteReviewLink(template, reviewUrl, {
    FIRST_NAME: firstName,
    NAME: customerDisplayName(customer),
    BUSINESS: businessName,
    SERVICE: service,
  });
}
