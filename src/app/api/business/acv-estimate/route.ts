import { NextResponse } from "next/server";
import { getPrimaryBusiness, loadBusinessConfig } from "@/audit/businesses";
import {
  buildAcvEstimateContext,
  estimateAverageCustomerValue,
  type AcvEstimateContext,
} from "@/lib/llm/acv-estimate";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { getUser } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/http/parse-json-body";

type AcvEstimateRequest = {
  businessId?: string;
  clientId?: string;
  businessName?: string;
  primaryCategory?: string;
  industry?: string | null;
  city?: string;
  state?: string;
};

async function resolveContext(
  userId: string,
  body: AcvEstimateRequest
): Promise<AcvEstimateContext | null> {
  if (body.clientId) {
    const business = await loadBusinessConfig(userId, body.clientId);
    const rawAudit = await loadLatestAuditFromSupabase(userId, body.clientId, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    if (rawAudit) {
      return buildAcvEstimateContext(rawAudit, business.industry);
    }
    return {
      businessName: business.name,
      primaryCategory: business.industry,
      industry: business.industry,
      city: business.location.city,
      state: business.location.state,
    };
  }

  const business = await getPrimaryBusiness(userId);
  const businessId = body.businessId ?? business?.businessId;
  if (!businessId || !business || business.businessId !== businessId) {
    if (body.businessName && body.primaryCategory) {
      return {
        businessName: body.businessName,
        primaryCategory: body.primaryCategory,
        industry: body.industry ?? body.primaryCategory,
        city: body.city ?? "",
        state: body.state ?? "",
      };
    }
    return null;
  }

  if (business.id) {
    const rawAudit = await loadLatestAuditFromSupabase(userId, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    if (rawAudit) {
      return buildAcvEstimateContext(rawAudit, business.industry);
    }
  }

  return {
    businessName: business.name,
    primaryCategory: body.primaryCategory ?? business.industry,
    industry: body.industry ?? business.industry,
    city: body.city ?? business.location.city,
    state: body.state ?? business.location.state,
  };
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await parseJsonBody<AcvEstimateRequest>(request);
    const context = await resolveContext(user.id, body);
    if (!context) {
      return NextResponse.json({ error: "No business configured" }, { status: 400 });
    }

    const estimate = await estimateAverageCustomerValue(context);
    return NextResponse.json({ estimate, context });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to estimate customer value";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
