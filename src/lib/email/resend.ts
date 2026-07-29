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

export function isResendConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()
  );
}

export function getResendFromAddress(businessName?: string): string | null {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!fromEmail) return null;

  const fromName = businessName?.trim() || process.env.RESEND_FROM_NAME?.trim();
  if (fromName) {
    return `${fromName} <${fromEmail}>`;
  }
  return fromEmail;
}

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) return null;

  return {
    apiKey,
    fromEmail,
    fromName: process.env.RESEND_FROM_NAME?.trim(),
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
  (resend.fromName ? `${resend.fromName} <${resend.fromEmail}>` : resend.fromEmail);

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
