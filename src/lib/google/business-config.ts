import { getGoogleMapsApiKey } from "./config";

/** API key for Places Details — falls back to GOOGLE_MAPS_API_KEY. */
export function getGoogleBusinessApiKey(): string | undefined {
  return process.env.GOOGLE_BUSINESS_API_KEY ?? getGoogleMapsApiKey();
}

export function isGoogleBusinessApiConfigured(): boolean {
  return Boolean(getGoogleBusinessApiKey());
}
