import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { updateExecutionTask } from "@/audit/storage-execution";
import { auditHasReviewGap } from "@/lib/review-requests/eligibility";
import { sendReviewRequests } from "@/lib/sms/send-review-requests";
import { isTwilioConfigured } from "@/lib/sms/twilio";
import { getUser } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/http/parse-json-body";

export async function POST(request: Request) {
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
      template?: string;
      customerIds?: string[];
      batchSize?: number;
      dryRun?: boolean;
      executionTaskId?: string;
      focusKeyword?: string | null;
    }>(request);

    if (!body.template?.trim()) {
      return NextResponse.json({ error: "Message template is required" }, { status: 400 });
    }

    const rawAudit = await loadLatestAuditFromSupabase(user.id, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;

    const result = await sendReviewRequests({
      userId: user.id,
      business,
      template: body.template.trim(),
      customerIds: body.customerIds,
      batchSize: body.batchSize,
      executionTaskId: body.executionTaskId,
      dryRun: body.dryRun,
      manualSend: true,
      focusKeyword: body.focusKeyword,
      auditHasReviewGap: auditHasReviewGap(audit),
    });

    if (body.executionTaskId && !body.dryRun && result.sent > 0) {
      const summary = result.simulated
        ? `Simulated ${result.sent} SMS review request${result.sent === 1 ? "" : "s"}.`
        : `Sent ${result.sent} SMS review request${result.sent === 1 ? "" : "s"}${result.failed > 0 ? ` (${result.failed} failed)` : ""}.`;

      await updateExecutionTask(user.id, body.executionTaskId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        result: summary,
        draftContent: body.template.trim(),
      });
    }

    return NextResponse.json({
      ...result,
      twilioConfigured: isTwilioConfigured(),
      geoFilterApplied: result.geoFilterApplied,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send review requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
