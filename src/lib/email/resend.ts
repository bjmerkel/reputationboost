export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  to: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export interface ParsedFromAddress {
  email: string;
  displayName?: string;
}

/** Parse `email@example.com` or `Name <email@example.com>` env values. */
export function parseFromAddress(value: string): ParsedFromAddress | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const bracketMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (bracketMatch) {
    const email = normalizeEmail(bracketMatch[2]);
    if (!email) return null;
    const displayName = unquoteDisplayName(bracketMatch[1].trim());
    return displayName ? { email, displayName } : { email };
  }

  const email = normalizeEmail(trimmed);
  return email ? { email } : null;
}

function unquoteDisplayName(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
  }
  return trimmed;
}

/** Quote display names that contain RFC 5322 special characters. */
export function escapeDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const needsQuotes = /[,;"<>\\()[\]:@]/.test(trimmed);
  if (!needsQuotes) return trimmed;
  return `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function splitEmailAddress(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim();
  if (!domain.includes(".")) return null;
  return { local: email.slice(0, at), domain };
}

/** Build a sender local part like PsychicJaycee from "Psychic Jaycee". */
export function businessNameToEmailLocalPart(name: string): string {
  const parts = name.trim().split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return "noreply";

  const local = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

  return local.slice(0, 64) || "noreply";
}

function isPerBusinessFromLocalPartEnabled(): boolean {
  const flag = process.env.RESEND_FROM_PER_BUSINESS?.trim().toLowerCase();
  return flag !== "false" && flag !== "0";
}

/** Swap the env local part for a business-specific one on the same domain. */
export function customizeFromEmailForBusiness(
  baseEmail: string,
  businessName?: string
): string {
  if (!businessName?.trim() || !isPerBusinessFromLocalPartEnabled()) {
    return baseEmail;
  }

  const split = splitEmailAddress(baseEmail);
  if (!split) return baseEmail;

  const local = businessNameToEmailLocalPart(businessName);
  return `${local}@${split.domain}`;
}

export function resolveResendFromEmail(businessName?: string): {
  email: string;
  displayName?: string;
} | null {
  const fromValue = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromValue) return null;

  const parsed = parseFromAddress(fromValue);
  if (!parsed) return null;

  const email = customizeFromEmailForBusiness(parsed.email, businessName);
  const displayName =
    businessName?.trim() ||
    process.env.RESEND_FROM_NAME?.trim() ||
    parsed.displayName;

  return { email, displayName };
}

export function formatEmailFromAddress(
  displayName: string | undefined,
  fromValue: string
): string | null {
  const parsed = parseFromAddress(fromValue);
  if (!parsed) return null;

  const name = displayName?.trim() || parsed.displayName;
  if (!name) return parsed.email;
  return `${escapeDisplayName(name)} <${parsed.email}>`;
}

export function isResendConfigured(): boolean {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  return Boolean(process.env.RESEND_API_KEY?.trim() && from && parseFromAddress(from));
}

export function getResendFromAddress(businessName?: string): string | null {
  const resolved = resolveResendFromEmail(businessName);
  if (!resolved) return null;

  const { email, displayName } = resolved;
  if (!displayName) return email;
  return `${escapeDisplayName(displayName)} <${email}>`;
}

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromValue = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !fromValue) return null;

  const parsed = parseFromAddress(fromValue);
  if (!parsed) return null;

  return {
    apiKey,
    fromEmail: parsed.email,
    fromName: process.env.RESEND_FROM_NAME?.trim() || parsed.displayName,
  };
}

export async function sendEmail(
  input: SendEmailInput,
  config?: ResendConfig,
  fromOverride?: string
): Promise<SendEmailResult> {
  const normalizedTo = normalizeEmail(input.to);
  if (!normalizedTo) {
    return { success: false, error: "Invalid email address", to: input.to };
  }

  const resend = config ?? getResendConfig();
  if (!resend) {
    return {
      success: false,
      error:
        "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment.",
      to: normalizedTo,
    };
  }

  const from =
    fromOverride ??
    (resend.fromName
      ? `${escapeDisplayName(resend.fromName)} <${resend.fromEmail}>`
      : resend.fromEmail);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [normalizedTo],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
        tags: input.tags,
      }),
    });

    const data = (await res.json()) as { id?: string; message?: string; name?: string };

    if (!res.ok) {
      return {
        success: false,
        error: data.message ?? data.name ?? `Resend error (${res.status})`,
        to: normalizedTo,
      };
    }

    return { success: true, messageId: data.id, to: normalizedTo };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    return { success: false, error: message, to: normalizedTo };
  }
}
