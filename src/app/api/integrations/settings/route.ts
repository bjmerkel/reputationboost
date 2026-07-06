import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { parseJsonBody } from "@/lib/http/parse-json-body";
import {
  getWebhookSettings,
  updateWebhookSettings,
} from "@/lib/integrations/webhook-storage";
import { auditHasReviewGap } from "@/lib/review-requests/eligibility";
import { getUser } from "@/lib/supabase/server";

function buildWebhookUrl(request: Request, token: string): string {
  const origin = new URL(request.url).origin;
  return `${origin}/api/integrations/webhook?token=${token}`;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const settings = await getWebhookSettings(user.id, business.businessId);
    const rawAudit = await loadLatestAuditFromSupabase(user.id, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;
    const hasReviewGap = auditHasReviewGap(audit);

    return NextResponse.json({
      webhookUrl: buildWebhookUrl(request, settings.webhookToken),
      autoSend: settings.autoSend,
      delayHours: settings.delayHours,
      triggerEvents: settings.triggerEvents,
      auditHasReviewGap: hasReviewGap,
      samplePayload: {
        event: "job.completed",
        phone: "214-555-0100",
        firstName: "Jane",
        lastName: "Doe",
        service: "water heater install",
        serviceDate: "2026-07-05",
        externalId: "job-12345",
        source: "jobber",
        sendReviewRequest: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load webhook settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const body = await parseJsonBody<{
      autoSend?: boolean;
      delayHours?: number;
      triggerEvents?: string[];
      rotateToken?: boolean;
    }>(request);

    const settings = await updateWebhookSettings(user.id, business.businessId, body);
    return NextResponse.json({
      webhookUrl: buildWebhookUrl(request, settings.webhookToken),
      autoSend: settings.autoSend,
      delayHours: settings.delayHours,
      triggerEvents: settings.triggerEvents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update webhook settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
