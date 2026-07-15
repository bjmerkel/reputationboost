import type { CustomerRecord } from "@/lib/customers/types";
import {
  resolveServiceForSms,
  type ServicePhraseLocation,
} from "@/lib/review-requests/service-phrase";
import { substituteReviewLink } from "./review-link";

export interface PersonalizeSmsOptions {
  template: string;
  customer: Pick<CustomerRecord, "first_name" | "last_name" | "service_notes">;
  businessName: string;
  reviewUrl: string;
  focusKeyword?: string | null;
  location?: ServicePhraseLocation;
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

/**
 * LLM-generated templates sometimes invent placeholders we do not substitute.
 * Rewrites known unsupported tokens before personalization.
 */
export function normalizeUnsupportedPlaceholders(template: string): string {
  let result = template;

  result = result.replace(
    /\bit['']s\s+\[OWNER_NAME\]\s+from\s+\[BUSINESS\]/gi,
    "[BUSINESS] here"
  );
  result = result.replace(/\bit['']s\s+\[OWNER_NAME\]\s+from\s+/gi, "from ");
  result = result.replace(/\[OWNER_NAME\]/gi, "the team");

  return result;
}

/** Final safety: drop any [TOKEN] left after substitution. */
export function stripRemainingPlaceholders(message: string): string {
  return message
    .replace(/\[[A-Z][A-Z0-9_]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function prepareReviewRequestTemplate(template: string, businessName: string): string {
  return ensureBusinessInTemplate(normalizeUnsupportedPlaceholders(template), businessName);
}

export function personalizeReviewRequestSms(options: PersonalizeSmsOptions): string {
  const { template, customer, businessName, reviewUrl, focusKeyword, location } = options;
  const firstName = customerFirstName(customer);
  const service = resolveServiceForSms({
    serviceNotes: customer.service_notes,
    focusKeyword,
    location,
  });

  const message = substituteReviewLink(prepareReviewRequestTemplate(template, businessName), reviewUrl, {
    FIRST_NAME: firstName,
    NAME: customerDisplayName(customer),
    BUSINESS: businessName,
    SERVICE: service,
  });

  return stripRemainingPlaceholders(message);
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
  focusKeyword?: string | null;
  location?: ServicePhraseLocation;
}): string {
  const { template, businessName, reviewUrl, customer, serviceFallback, focusKeyword, location } =
    options;
  const resolvedTemplate = prepareReviewRequestTemplate(template, businessName);

  if (customer) {
    return personalizeReviewRequestSms({
      template: resolvedTemplate,
      customer,
      businessName,
      reviewUrl,
      focusKeyword,
      location,
    });
  }

  const service = resolveServiceForSms({
    focusKeyword: focusKeyword ?? serviceFallback,
    location,
  });

  return stripRemainingPlaceholders(
    substituteReviewLink(resolvedTemplate, reviewUrl, {
      FIRST_NAME: "[FIRST_NAME]",
      NAME: "[NAME]",
      BUSINESS: businessName,
      SERVICE: service,
    })
  );
}
