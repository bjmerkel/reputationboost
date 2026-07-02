import type { ClientConfig } from "./types";

/** @deprecated Demo client removed — businesses are stored per user in Supabase. */
export function getClientConfig(clientId: string): ClientConfig {
  throw new Error(
    `Static client config is no longer supported (${clientId}). Sign in and complete onboarding.`
  );
}

export function listClients(): ClientConfig[] {
  return [];
}
