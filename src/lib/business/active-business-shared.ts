export const ACTIVE_BUSINESS_COOKIE = "active_business_id";

export interface BusinessSummary {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  onboardingComplete: boolean;
  gbpConnected: boolean;
  googleEmail?: string | null;
}

export function withBusinessId(path: string, businessId: string): string {
  const url = new URL(path, "http://local");
  url.searchParams.set("businessId", businessId);
  return `${url.pathname}${url.search}`;
}
