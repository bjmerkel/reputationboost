import type { ClientConfig, GbpConnection } from "@/audit/types";
import { getBusinessRecord, saveGbpTokens } from "@/audit/businesses";
import { refreshAccessToken } from "./oauth";

const EXPIRY_BUFFER_MS = 60_000;

export async function getValidGbpConnection(
  userId: string,
  client: ClientConfig
): Promise<GbpConnection | null> {
  if (!client.businessId || !client.gbpConnection?.refreshToken) {
    return null;
  }

  const row = await getBusinessRecord(userId, client.businessId);
  if (!row?.gbp_refresh_token || !row.gbp_account_id || !row.gbp_location_id) {
    return null;
  }

  const expiresAt = row.gbp_token_expires_at
    ? new Date(row.gbp_token_expires_at).getTime()
    : 0;

  if (row.gbp_access_token && expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return {
      businessId: row.id,
      accountId: row.gbp_account_id,
      locationId: row.gbp_location_id,
      placeId: row.gbp_place_id ?? undefined,
      accessToken: row.gbp_access_token,
      refreshToken: row.gbp_refresh_token,
      expiresAt: row.gbp_token_expires_at!,
    };
  }

  const refreshed = await refreshAccessToken(row.gbp_refresh_token);
  await saveGbpTokens(userId, row.id, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? row.gbp_refresh_token,
    expiresAt: refreshed.expiresAt,
  });

  return {
    businessId: row.id,
    accountId: row.gbp_account_id,
    locationId: row.gbp_location_id,
    placeId: row.gbp_place_id ?? undefined,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? row.gbp_refresh_token,
    expiresAt: refreshed.expiresAt,
  };
}

export function authHeadersForConnection(connection: GbpConnection): HeadersInit {
  return { Authorization: `Bearer ${connection.accessToken}` };
}
