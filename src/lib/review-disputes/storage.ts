import { createClient } from "@/lib/supabase/server";
import type {
  ReviewDisputePolicyViolation,
  ReviewDisputeRecord,
  ReviewDisputeStatus,
} from "./types";

interface ReviewDisputeRow {
  id: string;
  business_id: string;
  user_id: string;
  review_id: string;
  status: string;
  policy_violation: string;
  evidence_notes: string | null;
  reviewer_name: string | null;
  review_rating: number | null;
  review_text: string | null;
  review_published_at: string | null;
  execution_task_id: string | null;
  projected_score_gain: number | null;
  submitted_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ReviewDisputeRow): ReviewDisputeRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    reviewId: row.review_id,
    status: row.status as ReviewDisputeStatus,
    policyViolation: row.policy_violation as ReviewDisputePolicyViolation,
    evidenceNotes: row.evidence_notes,
    reviewerName: row.reviewer_name,
    reviewRating: row.review_rating,
    reviewText: row.review_text,
    reviewPublishedAt: row.review_published_at,
    executionTaskId: row.execution_task_id,
    projectedScoreGain: row.projected_score_gain,
    submittedAt: row.submitted_at,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReviewDisputes(
  userId: string,
  businessId: string
): Promise<ReviewDisputeRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_disputes")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as ReviewDisputeRow[]).map(mapRow);
}

export interface CreateReviewDisputeInput {
  businessId: string;
  userId: string;
  reviewId: string;
  policyViolation: ReviewDisputePolicyViolation;
  evidenceNotes?: string;
  reviewerName?: string;
  reviewRating?: number;
  reviewText?: string;
  reviewPublishedAt?: string;
  executionTaskId?: string;
  projectedScoreGain?: number;
  status?: ReviewDisputeStatus;
}

export async function upsertReviewDispute(
  input: CreateReviewDisputeInput
): Promise<ReviewDisputeRecord> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const status = input.status ?? "flagged";

  const { data, error } = await supabase
    .from("review_disputes")
    .upsert(
      {
        business_id: input.businessId,
        user_id: input.userId,
        review_id: input.reviewId,
        status,
        policy_violation: input.policyViolation,
        evidence_notes: input.evidenceNotes ?? null,
        reviewer_name: input.reviewerName ?? null,
        review_rating: input.reviewRating ?? null,
        review_text: input.reviewText ?? null,
        review_published_at: input.reviewPublishedAt ?? null,
        execution_task_id: input.executionTaskId ?? null,
        projected_score_gain: input.projectedScoreGain ?? null,
        submitted_at: status === "submitted" ? now : null,
        updated_at: now,
      },
      { onConflict: "business_id,review_id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as ReviewDisputeRow);
}

export async function updateReviewDispute(
  userId: string,
  disputeId: string,
  patch: {
    status?: ReviewDisputeStatus;
    policyViolation?: ReviewDisputePolicyViolation;
    evidenceNotes?: string;
    resolutionNotes?: string;
  }
): Promise<ReviewDisputeRecord> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };

  if (patch.status) {
    updates.status = patch.status;
    if (patch.status === "submitted") updates.submitted_at = now;
    if (["removed", "declined", "withdrawn"].includes(patch.status)) {
      updates.resolved_at = now;
    }
  }
  if (patch.policyViolation) updates.policy_violation = patch.policyViolation;
  if (patch.evidenceNotes !== undefined) updates.evidence_notes = patch.evidenceNotes;
  if (patch.resolutionNotes !== undefined) updates.resolution_notes = patch.resolutionNotes;

  const { data, error } = await supabase
    .from("review_disputes")
    .update(updates)
    .eq("id", disputeId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as ReviewDisputeRow);
}

export async function getReviewDispute(
  userId: string,
  disputeId: string
): Promise<ReviewDisputeRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_disputes")
    .select("*")
    .eq("id", disputeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data as ReviewDisputeRow) : null;
}
