import { createHmac, timingSafeEqual } from "crypto";

function hostSecret(): string {
  const secret =
    process.env.GBP_MEDIA_HOST_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.GBP_OAUTH_CLIENT_SECRET;
  if (!secret) {
    throw new Error("GBP media hosting is not configured on the server.");
  }
  return secret;
}

/** Short-lived signed token so Google can fetch a preview image via sourceUrl. */
export function signMediaHostToken(taskId: string, expiresAt: number): string {
  const mac = createHmac("sha256", hostSecret())
    .update(`${taskId}:${expiresAt}`)
    .digest("base64url");
  return `${expiresAt}.${mac}`;
}

export function verifyMediaHostToken(taskId: string, token: string): boolean {
  const [expiresAtStr, mac] = token.split(".");
  if (!expiresAtStr || !mac) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedMac = signMediaHostToken(taskId, expiresAt).split(".")[1];
  if (!expectedMac || expectedMac.length !== mac.length) return false;

  return timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac));
}

export function createMediaHostToken(taskId: string, ttlMs = 10 * 60 * 1000): string {
  return signMediaHostToken(taskId, Date.now() + ttlMs);
}

export function publicSiteUrl(): string {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return site.replace(/\/$/, "");
}

export function buildMediaHostUrl(taskId: string, token: string): string {
  return `${publicSiteUrl()}/api/google/gbp/media/host/${taskId}/${token}`;
}
