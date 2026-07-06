import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { ensureStrategy } from "@/audit/ensure-strategy";
import { getEligibleCustomers, listCustomers } from "@/lib/customers/storage";
import { generateReviewRequestMessage } from "@/lib/llm/review-request-sms";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { personalizeReviewRequestSms } from "@/lib/sms/personalize";
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
    const body = await parseJsonBody<{ customerId?: string }>(request);
    const { total: eligibleCount } = await listCustomers(user.id, business.businessId, {
      eligibleOnly: true,
      limit: 1,
    });
    const eligible = await getEligibleCustomers(user.id, business.businessId, 1);
    const sampleCustomer =
      (body.customerId
        ? eligible.find((c) => c.id === body.customerId) ?? eligible[0]
        : eligible[0]) ?? null;

    const rawAudit = await loadLatestAuditFromSupabase(user.id, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;

    const address = [
      business.location.address,
      business.location.city,
      business.location.state,
      business.location.zip,
    ]
      .filter(Boolean)
      .join(", ");

    const reviewUrl = googleReviewUrlForBusiness({
      placeId: business.gbpPlaceId,
      mapsUrl: business.gbpMapsUrl,
      name: business.name,
      address,
    });

    let template: string;
    if (audit) {
      template = await generateReviewRequestMessage(
        audit,
        sampleCustomer ?? undefined
      );
    } else {
      const firstName = sampleCustomer?.first_name?.trim() || "[FIRST_NAME]";
      const service = sampleCustomer?.service_notes?.trim() || "[SERVICE]";
      template = `Hi ${firstName}! Thanks for choosing ${business.name} for ${service}. We'd love your feedback on Google — it helps neighbors find us: [REVIEW_LINK]`;
    }

    const preview = sampleCustomer
      ? personalizeReviewRequestSms({
          template,
          customer: sampleCustomer,
          businessName: business.name,
          reviewUrl: reviewUrl ?? "https://example.com/review",
        })
      : template;

    return NextResponse.json({
      template,
      preview,
      reviewUrl,
      eligibleCount,
      placeholders: ["[FIRST_NAME]", "[NAME]", "[SERVICE]", "[BUSINESS]", "[REVIEW_LINK]"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
