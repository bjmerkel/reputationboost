export const CUSTOMERS_TABS = [
  {
    id: "review-requests",
    label: "Review requests",
    shortLabel: "Reviews",
    description:
      "Import your customer list, personalize a Google review request, and send it by SMS or email.",
  },
  {
    id: "profile-guide",
    label: "Profile Guide",
    shortLabel: "Guide",
    description:
      "A branded mobile page and QR code that drives reviews, directions, calls, and bookings from your Google Business Profile.",
  },
] as const;

export type CustomersTabId = (typeof CUSTOMERS_TABS)[number]["id"];

const TAB_IDS = new Set<CustomersTabId>(CUSTOMERS_TABS.map((tab) => tab.id));

export function parseCustomersTab(value: string | undefined): CustomersTabId {
  if (value && TAB_IDS.has(value as CustomersTabId)) {
    return value as CustomersTabId;
  }
  return "review-requests";
}

export function customersTabHref(tab: CustomersTabId, businessId?: string | null): string {
  const params = new URLSearchParams();
  if (businessId) params.set("businessId", businessId);
  if (tab !== "review-requests") params.set("tab", tab);
  const query = params.toString();
  return `/platform/customers${query ? `?${query}` : ""}`;
}
