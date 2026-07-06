import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/http/parse-json-body";
import { processInboundWebhook } from "@/lib/integrations/process-webhook";
import { extractWebhookToken } from "@/lib/integrations/webhook-token";

export async function POST(request: Request) {
  const token = extractWebhookToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing webhook token. Pass ?token=, X-Webhook-Token, or Authorization: Bearer." },
      { status: 401 }
    );
  }

  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const result = await processInboundWebhook(token, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    const status =
      message === "Invalid webhook token"
        ? 401
        : message.includes("Missing required field")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
