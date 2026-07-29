import { NextResponse } from "next/server";
import { processInboundSms } from "@/lib/sms/process-inbound-sms";
import { validateTwilioRequestSignature } from "@/lib/sms/twilio-signature";

function twimlResponse(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/** Receive inbound SMS from the platform Twilio number (STOP / START handling). */
export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    return NextResponse.json({ error: "Twilio is not configured" }, { status: 503 });
  }

  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }

  const signature = request.headers.get("x-twilio-signature");
  const requestUrl = request.url;
  if (!validateTwilioRequestSignature(authToken, signature, requestUrl, params)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  const fromPhone = params.From ?? "";
  const body = params.Body ?? "";
  const messageSid = params.MessageSid;

  try {
    const result = await processInboundSms({ fromPhone, body, messageSid });

    if (result.preference === "opt_out" && result.handled) {
      return twimlResponse("You have been unsubscribed from review request texts.");
    }

    if (result.preference === "opt_in" && result.handled) {
      return twimlResponse("You are subscribed to review request texts. Reply STOP to unsubscribe.");
    }

    return twimlResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbound SMS processing failed";
    console.error("[twilio/sms]", message);
    return twimlResponse();
  }
}
