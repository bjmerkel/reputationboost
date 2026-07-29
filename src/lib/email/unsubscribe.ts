import { createHmac, timingSafeEqual } from "node:crypto";

function getUnsubscribeSecret(): string {
  const secret =
    process.env.UNSUBSCRIBE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new Error("Unsubscribe secret is not configured");
  }
  return secret;
}

export function buildUnsubscribeToken(customerId: string, businessId: string): string {
  const payload = `${customerId}:${businessId}`;
  const signature = createHmac("sha256", getUnsubscribeSecret())
    .update(payload)
    .digest("base64url");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

export function parseUnsubscribeToken(
  token: string
): { customerId: string; businessId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon <= 0) return null;

    const payload = decoded.slice(0, lastColon);
    const signature = decoded.slice(lastColon + 1);
    const secondColon = payload.indexOf(":");
    if (secondColon <= 0) return null;

    const customerId = payload.slice(0, secondColon);
    const businessId = payload.slice(secondColon + 1);
    if (!customerId || !businessId) return null;

    const expected = createHmac("sha256", getUnsubscribeSecret())
      .update(payload)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    return { customerId, businessId };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(customerId: string, businessId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "http://localhost:3000";
  const origin = base.startsWith("http") ? base : `https://${base}`;
  const token = buildUnsubscribeToken(customerId, businessId);
  return `${origin}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
