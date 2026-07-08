import type { CustomerRecord } from "@/lib/customers/types";

export type CustomerKeywordHint = Pick<
  CustomerRecord,
  "first_name" | "last_name" | "service_notes"
>;

function normalizePersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatchForReviewer(
  reviewerName: string,
  firstName: string,
  lastName: string
): boolean {
  const reviewer = normalizePersonName(reviewerName);
  if (!reviewer || reviewer === "anonymous" || reviewer === "a google user") {
    return false;
  }

  const customerFull = normalizePersonName(`${firstName} ${lastName}`.trim());
  if (!customerFull) return false;
  if (reviewer === customerFull) return true;

  const first = normalizePersonName(firstName);
  const last = normalizePersonName(lastName);
  if (first && last && reviewer.includes(first) && reviewer.includes(last)) return true;
  if (first && reviewer.split(" ")[0] === first && last && reviewer.endsWith(last)) return true;

  return false;
}

function significantTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3 && !["near", "best", "local"].includes(word));
}

function serviceNotesMatchKeyword(notes: string, keyword: string): boolean {
  const tokens = significantTokens(keyword);
  const lower = notes.toLowerCase();
  if (tokens.length === 0) return lower.includes(keyword.toLowerCase());
  return tokens.some((token) => lower.includes(token));
}

export function findCustomerForReviewer(
  reviewAuthor: string,
  customers: CustomerKeywordHint[]
): CustomerKeywordHint | null {
  for (const customer of customers) {
    if (
      namesMatchForReviewer(
        reviewAuthor,
        customer.first_name ?? "",
        customer.last_name ?? ""
      )
    ) {
      return customer;
    }
  }
  return null;
}

export function customerServiceMatchesKeyword(
  reviewAuthor: string,
  keyword: string,
  customers: CustomerKeywordHint[]
): boolean {
  const customer = findCustomerForReviewer(reviewAuthor, customers);
  if (!customer?.service_notes?.trim()) return false;
  return serviceNotesMatchKeyword(customer.service_notes, keyword);
}

export function customerServiceNotesForReviewer(
  reviewAuthor: string,
  customers: CustomerKeywordHint[]
): string | null {
  const customer = findCustomerForReviewer(reviewAuthor, customers);
  return customer?.service_notes?.trim() || null;
}
