import { createHmac, timingSafeEqual } from "crypto";

export function validateTwilioRequestSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature) return false;

  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }

  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
