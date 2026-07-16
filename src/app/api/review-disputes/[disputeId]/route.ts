import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { getReviewDispute, updateReviewDispute } from "@/lib/review-disputes/storage";
import { buildGbpReviewReportUrl } from "@/lib/review-disputes/gbp-report-url";
import type { ReviewDisputeStatus } from "@/lib/review-disputes/types";
import { getUser } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { disputeId } = await params;
  const body = (await request.json()) as {
    status?: ReviewDisputeStatus;
    evidenceNotes?: string;
    resolutionNotes?: string;
  };

  const existing = await getReviewDispute(user.id, disputeId);
  if (!existing) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  try {
    const business = await getPrimaryBusiness(user.id);
    const dispute = await updateReviewDispute(user.id, disputeId, body);
    return NextResponse.json({
      dispute,
      reportUrl: buildGbpReviewReportUrl(business?.gbpPlaceId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update dispute";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
