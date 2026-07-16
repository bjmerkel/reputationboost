import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { identifyDisputeCandidates } from "@/lib/review-disputes/candidates";
import { buildGbpReviewReportUrl } from "@/lib/review-disputes/gbp-report-url";
import { estimateDisputeOverallScoreGain } from "@/lib/review-disputes/score-impact";
import { listReviewDisputes, upsertReviewDispute } from "@/lib/review-disputes/storage";
import type { ReviewDisputePolicyViolation } from "@/lib/review-disputes/types";
import { getUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const rawAudit = await loadLatestAuditFromSupabase(user.id, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;
    const disputes = await listReviewDisputes(user.id, business.businessId);
    const candidates = audit ? identifyDisputeCandidates(audit, disputes) : [];
    const projectedOverallGain = audit ? estimateDisputeOverallScoreGain(audit) : 0;

    return NextResponse.json({
      disputes,
      candidates,
      projectedOverallGain,
      reportUrl: buildGbpReviewReportUrl(business.gbpPlaceId),
      businessName: business.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load disputes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const body = (await request.json()) as {
    reviewId: string;
    policyViolation: ReviewDisputePolicyViolation;
    evidenceNotes?: string;
    reviewerName?: string;
    reviewRating?: number;
    reviewText?: string;
    reviewPublishedAt?: string;
    executionTaskId?: string;
    projectedScoreGain?: number;
    status?: "flagged" | "submitted";
  };

  if (!body.reviewId || !body.policyViolation) {
    return NextResponse.json({ error: "reviewId and policyViolation are required" }, { status: 400 });
  }

  try {
    const dispute = await upsertReviewDispute({
      businessId: business.businessId,
      userId: user.id,
      reviewId: body.reviewId,
      policyViolation: body.policyViolation,
      evidenceNotes: body.evidenceNotes,
      reviewerName: body.reviewerName,
      reviewRating: body.reviewRating,
      reviewText: body.reviewText,
      reviewPublishedAt: body.reviewPublishedAt,
      executionTaskId: body.executionTaskId,
      projectedScoreGain: body.projectedScoreGain,
      status: body.status ?? "flagged",
    });

    return NextResponse.json({
      dispute,
      reportUrl: buildGbpReviewReportUrl(business.gbpPlaceId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save dispute";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
