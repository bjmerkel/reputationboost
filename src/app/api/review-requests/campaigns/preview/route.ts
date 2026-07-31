import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import type { OutreachChannel } from "@/lib/review-requests/channel";
import { auditHasReviewGap } from "@/lib/review-requests/eligibility";
import { planOutreachCampaign } from "@/lib/review-requests/outreach-campaign";
import { getUser } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/http/parse-json-body";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const body = await parseJsonBody<{
      channel?: OutreachChannel;
      template?: string;
      smsTemplate?: string;
      subject?: string;
      customerIds?: string[];
      focusKeyword?: string | null;
      dailySendCap?: number;
      enableGeoRouting?: boolean;
    }>(request);

    const channel: OutreachChannel = body.channel ?? "sms";
    if (!body.template?.trim()) {
      return NextResponse.json({ error: "Message template is required" }, { status: 400 });
    }
    if ((channel === "email" || channel === "auto") && !body.subject?.trim()) {
      return NextResponse.json({ error: "Email subject is required" }, { status: 400 });
    }
    if (channel === "auto" && !body.smsTemplate?.trim()) {
      return NextResponse.json({ error: "SMS template is required for Smart mode" }, { status: 400 });
    }

    const rawAudit = await loadLatestAuditFromSupabase(user.id, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;

    const preview = await planOutreachCampaign({
      userId: user.id,
      business,
      channel,
      smsTemplate: body.smsTemplate?.trim() || body.template.trim(),
      emailTemplate: body.template.trim(),
      emailSubject: body.subject?.trim(),
      customerIds: body.customerIds,
      focusKeyword: body.focusKeyword,
      dailySendCap: body.dailySendCap,
      enableGeoRouting: body.enableGeoRouting,
      auditHasReviewGap: auditHasReviewGap(audit),
    });

    const { plannedEntries, ...publicPreview } = preview;

    return NextResponse.json({
      preview: publicPreview,
      eligible: preview.eligible,
      smsCount: preview.smsCount,
      emailCount: preview.emailCount,
      estimatedDays: preview.estimatedDays,
      dailySendCap: preview.dailySendCap,
      skipped: preview.skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to preview campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
