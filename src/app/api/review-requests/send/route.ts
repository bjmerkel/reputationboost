import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { sendReviewRequests } from "@/lib/sms/send-review-requests";
import { isTwilioConfigured } from "@/lib/sms/twilio";
import { getUser } from "@/lib/supabase/server";

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
    const body = (await request.json()) as {
      template?: string;
      customerIds?: string[];
      batchSize?: number;
      dryRun?: boolean;
      executionTaskId?: string;
    };

    if (!body.template?.trim()) {
      return NextResponse.json({ error: "Message template is required" }, { status: 400 });
    }

    const result = await sendReviewRequests({
      userId: user.id,
      business,
      template: body.template.trim(),
      customerIds: body.customerIds,
      batchSize: body.batchSize,
      executionTaskId: body.executionTaskId,
      dryRun: body.dryRun,
    });

    return NextResponse.json({
      ...result,
      twilioConfigured: isTwilioConfigured(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send review requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
