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
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromEmail) return null;

  const envName = process.env.RESEND_FROM_NAME?.trim();
  const displayName = businessName?.trim() || envName || undefined;
  return formatEmailFromAddress(displayName, fromEmail);
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
