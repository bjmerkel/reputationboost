import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadAuditByIdFromSupabase } from "@/audit/storage-supabase";
import { getExecutionTask, updateExecutionTask } from "@/audit/storage-execution";
import { isValidReviewId } from "@/audit/phase3/plan-task-utils";
import { regenerateReviewResponse } from "@/lib/review-responses/regenerate";
import { loadCustomerKeywordHints } from "@/lib/review-responses/load-customer-hints";
import { getActiveKeywordCampaigns } from "@/lib/review-requests/campaign-storage";
import { getUser } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await getExecutionTask(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.type !== "review_response") {
    return NextResponse.json({ error: "Not a review response task" }, { status: 400 });
  }

  if (task.status === "completed") {
    return NextResponse.json({ error: "Cannot regenerate a published reply" }, { status: 400 });
  }

  const reviewId = task.payload.reviewId;
  if (!isValidReviewId(reviewId)) {
    return NextResponse.json({ error: "Invalid review id on task" }, { status: 400 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const audit = await loadAuditByIdFromSupabase(user.id, business.id, task.auditId);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found for this task" }, { status: 404 });
  }

  const businessId = business.businessId;
  if (!businessId) {
    return NextResponse.json({ error: "Business record incomplete" }, { status: 400 });
  }

  const review = audit.reviews.reviews.find((row) => row.id === reviewId);
  if (!review) {
    return NextResponse.json({ error: "Review not found in audit payload" }, { status: 404 });
  }

  let body: { weaveKeyword?: boolean; keyword?: string } = {};
  try {
    body = (await request.json()) as { weaveKeyword?: boolean; keyword?: string };
  } catch {
    body = {};
  }

  const campaigns = await getActiveKeywordCampaigns(user.id, businessId).catch(() => []);
  const activeCampaignKeywords = campaigns.map((campaign) => campaign.keyword);
  const customers = await loadCustomerKeywordHints(user.id, businessId);
  const fallbackKeyword =
    typeof task.payload.suggestedKeyword === "string" ? task.payload.suggestedKeyword : null;

  try {
    const regenerated = await regenerateReviewResponse(audit, review, {
      weaveKeyword: body.weaveKeyword === true,
      keyword: body.keyword,
      fallbackKeyword,
      activeCampaignKeywords,
      customers,
    });

    const saved = await updateExecutionTask(user.id, taskId, {
      draftContent: regenerated.response,
      payload: {
        ...task.payload,
        ...regenerated.keywordPayload,
        keywordWeave: regenerated.keywordWeave,
      },
    });

    return NextResponse.json({ task: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regeneration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
