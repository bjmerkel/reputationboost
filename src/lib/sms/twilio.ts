import { normalizePhoneE164 } from "./phone";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
}

export interface SendSmsResult {
  success: boolean;
  sid?: string;
  error?: string;
  to: string;
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );
}

function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return null;
  }

  return { accountSid, authToken, fromNumber, messagingServiceSid };
}

export async function sendSms(
  to: string,
  body: string,
  config?: TwilioConfig
): Promise<SendSmsResult> {
  const normalizedTo = normalizePhoneE164(to);
  if (!normalizedTo) {
    return { success: false, error: "Invalid phone number", to };
  }

  const twilio = config ?? getTwilioConfig();
  if (!twilio) {
    return {
      success: false,
      error: "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
      to: normalizedTo,
    };
  }

  const params = new URLSearchParams({
    To: normalizedTo,
    Body: body,
  });

  if (twilio.messagingServiceSid) {
    params.set("MessagingServiceSid", twilio.messagingServiceSid);
  } else if (twilio.fromNumber) {
    params.set("From", twilio.fromNumber);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
  const auth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await res.json()) as { sid?: string; message?: string };

    if (!res.ok) {
      return {
        success: false,
        error: data.message ?? `Twilio error (${res.status})`,
        to: normalizedTo,
      };
    }

    return { success: true, sid: data.sid, to: normalizedTo };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMS send failed";
    return { success: false, error: message, to: normalizedTo };
  }
}
