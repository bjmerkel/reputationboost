import { randomBytes } from "node:crypto";

export function generateWebhookToken(): string {
  return `wb_${randomBytes(24).toString("hex")}`;
}

export function extractWebhookToken(request: Request): string | null {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token")?.trim();
  if (queryToken) return queryToken;

  const headerToken = request.headers.get("x-webhook-token")?.trim();
  if (headerToken) return headerToken;

  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() || null;
  }

  return null;
}
