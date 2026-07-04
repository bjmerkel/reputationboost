import type { ClientConfig, GbpConnection } from "@/audit/types";
import type { BusinessRecord } from "@/audit/businesses";
import { getBusinessRecord, saveGbpTokens } from "@/audit/businesses";
import { getGoogleTokenEmail } from "./gbp-access";
import { authHeadersForConnection } from "./auth-headers";
import { refreshAccessToken } from "./oauth";

export { authHeadersForConnection };

const EXPIRY_BUFFER_MS = 60_000;

function connectionFromRow(
  row: NonNullable<Awaited<ReturnType<typeof getBusinessRecord>>>,
  accessToken: string,
  refreshToken: string,
  expiresAt: string
): GbpConnection {
  return {
    businessId: row.id,
    accountId: row.gbp_account_id!,
    locationId: row.gbp_location_id!,
    placeId: row.gbp_place_id ?? undefined,
    googleEmail: row.gbp_google_email ?? undefined,
    accessToken,
    refreshToken,
    expiresAt,
  };
}

async function backfillGoogleEmail(
  userId: string,
  businessId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
  existingEmail?: string | null
): Promise<string | undefined> {
  if (existingEmail) return existingEmail.toLowerCase();

  const email = await getGoogleTokenEmail(accessToken);
  if (!email) return undefined;

  await saveGbpTokens(userId, businessId, {
    accessToken,
    refreshToken,
    expiresAt,
    googleEmail: email,
  });

  return email;
}

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
    const googleEmail = await backfillGoogleEmail(
      userId,
      row.id,
      row.gbp_access_token,
      row.gbp_refresh_token,
      row.gbp_token_expires_at!,
      row.gbp_google_email
    );

    return {
      ...connectionFromRow(
        row,
        row.gbp_access_token,
        row.gbp_refresh_token,
        row.gbp_token_expires_at!
      ),
      googleEmail: googleEmail ?? row.gbp_google_email ?? undefined,
    };
  }

  const refreshed = await refreshAccessToken(row.gbp_refresh_token);
  const googleEmail = await backfillGoogleEmail(
    userId,
    row.id,
    refreshed.accessToken,
    refreshed.refreshToken ?? row.gbp_refresh_token,
    refreshed.expiresAt,
    row.gbp_google_email
  );

  return {
    ...connectionFromRow(
      row,
      refreshed.accessToken,
      refreshed.refreshToken ?? row.gbp_refresh_token,
      refreshed.expiresAt
    ),
    googleEmail: googleEmail ?? row.gbp_google_email ?? undefined,
  };
}

export async function getGbpAccessTokenForRecord(
  row: BusinessRecord
): Promise<string | null> {
  if (!row.gbp_refresh_token) return null;

  const expiresAt = row.gbp_token_expires_at
    ? new Date(row.gbp_token_expires_at).getTime()
    : 0;

  if (row.gbp_access_token && expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return row.gbp_access_token;
  }

  const refreshed = await refreshAccessToken(row.gbp_refresh_token);
  await saveGbpTokens(row.user_id, row.id, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? row.gbp_refresh_token,
    expiresAt: refreshed.expiresAt,
    googleEmail: row.gbp_google_email ?? undefined,
  });

  return refreshed.accessToken;
}

/** Refresh GBP connection for cron/backfill using a business row (no user session). */
export async function getValidGbpConnectionForRecord(
  row: BusinessRecord
): Promise<GbpConnection | null> {
  if (!row.gbp_refresh_token || !row.gbp_account_id || !row.gbp_location_id) {
    return null;
  }

  const expiresAt = row.gbp_token_expires_at
    ? new Date(row.gbp_token_expires_at).getTime()
    : 0;

  if (row.gbp_access_token && expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    const googleEmail = await backfillGoogleEmail(
      row.user_id,
      row.id,
      row.gbp_access_token,
      row.gbp_refresh_token,
      row.gbp_token_expires_at!,
      row.gbp_google_email
    );

    return {
      ...connectionFromRow(
        row,
        row.gbp_access_token,
        row.gbp_refresh_token,
        row.gbp_token_expires_at!
      ),
      googleEmail: googleEmail ?? row.gbp_google_email ?? undefined,
    };
  }

  const refreshed = await refreshAccessToken(row.gbp_refresh_token);
  const googleEmail = await backfillGoogleEmail(
    row.user_id,
    row.id,
    refreshed.accessToken,
    refreshed.refreshToken ?? row.gbp_refresh_token,
    refreshed.expiresAt,
    row.gbp_google_email
  );

  return {
    ...connectionFromRow(
      row,
      refreshed.accessToken,
      refreshed.refreshToken ?? row.gbp_refresh_token,
      refreshed.expiresAt
    ),
    googleEmail: googleEmail ?? row.gbp_google_email ?? undefined,
  };
}
