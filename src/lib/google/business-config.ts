import { getGoogleMapsApiKey } from "./config";

/** API key for Places Details — falls back to GOOGLE_MAPS_API_KEY. */
export function getGoogleBusinessApiKey(): string | undefined {
  return process.env.GOOGLE_BUSINESS_API_KEY ?? getGoogleMapsApiKey();
}

export function isGoogleBusinessApiConfigured(): boolean {
  return Boolean(getGoogleBusinessApiKey());
}

/** OAuth access token for Business Profile Management / Performance APIs. */
export function getGbpAccessToken(): string | undefined {
  return process.env.GOOGLE_BUSINESS_ACCESS_TOKEN;
}

/** GBP location resource ID (numeric), e.g. 12345678901234567890 */
export function getGbpLocationId(): string | undefined {
  return process.env.GOOGLE_BUSINESS_LOCATION_ID;
}

/** GBP account resource ID for v4 review/post endpoints. */
export function getGbpAccountId(): string | undefined {
  return process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
}

export function isGbpOAuthConfigured(): boolean {
  return Boolean(getGbpAccessToken() && getGbpLocationId());
}
