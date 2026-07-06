/**
 * Normalize a phone number to E.164 for Twilio (US-centric default +1).
 */
export function normalizePhoneE164(raw: string, defaultCountryCode = "1"): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;

  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length >= 11) {
    return `+${digits}`;
  }

  return null;
}

export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const mid = digits.slice(4, 7);
    const last = digits.slice(7);
    return `(${area}) ${mid}-${last}`;
  }
  return e164;
}
