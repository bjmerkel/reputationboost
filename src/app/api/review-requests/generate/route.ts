import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { loadLatestAuditFromSupabase } from "@/audit/storage-supabase";
import { ensureStrategy } from "@/audit/ensure-strategy";
import {
  buildReviewCampaignPlan,
  countCustomersMatchingKeyword,
  customerMatchesKeyword,
  selectCustomersForCampaign,
} from "@/lib/review-requests/campaign-plan";
import { getActiveKeywordCampaigns } from "@/lib/review-requests/campaign-storage";
import { refreshCampaignCompletionsForBusiness } from "@/lib/review-requests/campaign-dashboard";
import { getEligibleCustomers, listCustomers } from "@/lib/customers/storage";
import { getCustomerGeoCoverageForUser } from "@/lib/customers/geo-stats";
import { generateReviewRequestMessage } from "@/lib/llm/review-request-sms";
import { selectCustomersForGeoCampaign } from "@/lib/review-velocity/geo-router";
import { loadKeywordGridsForAudit } from "@/lib/review-velocity/resolve-geo-routing";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { previewReviewRequestSms } from "@/lib/sms/personalize";
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
    const body = await parseJsonBody<{ customerId?: string; focusKeyword?: string | null }>(request);
    const { customers: eligibleCustomers, total: eligibleCount } = await listCustomers(
      user.id,
      business.businessId,
      { eligibleOnly: true, limit: 100 }
    );
    const eligible = await getEligibleCustomers(user.id, business.businessId, 100);
    const sampleCustomer =
      (body.customerId
        ? eligible.find((c) => c.id === body.customerId) ?? eligible[0]
        : eligible[0]) ?? null;

    const rawAudit = await loadLatestAuditFromSupabase(user.id, business.id, {
      businessName: business.name,
      businessUuid: business.businessId,
    });
    const audit = rawAudit ? ensureStrategy(rawAudit) : null;
    const campaigns = await getActiveKeywordCampaigns(user.id, business.businessId);
    if (audit) {
      await refreshCampaignCompletionsForBusiness(user.id, business.businessId, audit);
    }
    const refreshedCampaigns = audit
      ? await getActiveKeywordCampaigns(user.id, business.businessId)
      : campaigns;

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

    const draftPlan = audit
      ? buildReviewCampaignPlan(audit, {
          eligibleCount,
          focusKeywordOverride: body.focusKeyword ?? null,
        })
      : null;

    const focusKeyword = body.focusKeyword ?? draftPlan?.focusKeyword ?? null;
    const matchedCustomers = countCustomersMatchingKeyword(eligibleCustomers, focusKeyword);
    const batchSize = draftPlan?.batchSize ?? 15;

    let keywordFilterApplied = false;
    let geoFilterApplied = false;
    let customersWithGeo = eligibleCustomers.filter(
      (customer) => customer.grid_north != null && customer.grid_east != null
    ).length;

    let keywordGrids: Awaited<ReturnType<typeof loadKeywordGridsForAudit>> | undefined;
    if (audit) {
      keywordGrids = await loadKeywordGridsForAudit(business.businessId, audit);
      if (keywordGrids.size > 0) {
        const geoSelected = selectCustomersForGeoCampaign({
          customers: eligibleCustomers,
          audit,
          keywordGrids,
          batchSize,
          focusKeyword,
        });
        geoFilterApplied = geoSelected.geoFilterApplied;
      }
    }

    if (!geoFilterApplied) {
      const keywordSelected = selectCustomersForCampaign(
        eligibleCustomers,
        focusKeyword,
        batchSize
      );
      keywordFilterApplied = keywordSelected.keywordFilterApplied;
    }

    const geoCoverage = await getCustomerGeoCoverageForUser(user.id, business.businessId);

    const campaignPlan = audit
      ? buildReviewCampaignPlan(audit, {
          eligibleCount,
          matchedToFocusKeyword: matchedCustomers,
          focusKeywordOverride: focusKeyword,
          keywordFilterApplied,
          campaigns: refreshedCampaigns,
        })
      : null;

    const keywordMatchedSample =
      focusKeyword && eligible.length > 0
        ? eligible.find((c) => customerMatchesKeyword(c, focusKeyword)) ?? sampleCustomer
        : sampleCustomer;

    const geoSample =
      eligible.find((customer) => customer.grid_north != null && customer.grid_east != null) ??
      keywordMatchedSample;

    const useGeoTemplate = geoFilterApplied && customersWithGeo > 0;
    let template: string;
    if (audit) {
      template = await generateReviewRequestMessage(
        audit,
        geoSample ?? keywordMatchedSample ?? undefined,
        focusKeyword,
        useGeoTemplate
          ? {
              geoTargeted: true,
              neighborhoodLabel:
                geoSample?.service_city?.trim() || business.location.city || undefined,
              promptSeed: focusKeyword ?? undefined,
            }
          : undefined
      );
    } else {
      const firstName = keywordMatchedSample?.first_name?.trim() || "[FIRST_NAME]";
      template = `Hi ${firstName}! Thanks for choosing [BUSINESS] for [SERVICE]. If your experience was great, a quick Google review would mean a lot: [REVIEW_LINK]`;
    }

    const previewCustomer = geoSample ?? keywordMatchedSample ?? sampleCustomer;
    const preview = previewReviewRequestSms({
      template,
      businessName: business.name,
      reviewUrl: reviewUrl ?? "https://example.com/review",
      customer: previewCustomer,
      focusKeyword,
      neighborhoodLabel:
        previewCustomer?.service_city?.trim() || business.location.city || null,
      location: {
        city: business.location.city,
        state: business.location.state,
      },
    });

    return NextResponse.json({
      template,
      preview,
      reviewUrl,
      eligibleCount,
      matchedCustomers,
      customersWithGeo,
      geoCoveragePercent: geoCoverage.coveragePercent,
      focusKeyword,
      batchSize: campaignPlan?.batchSize ?? batchSize,
      keywordFilterApplied,
      geoFilterApplied,
      campaignPlan,
      placeholders: useGeoTemplate
        ? ["[FIRST_NAME]", "[NAME]", "[SERVICE]", "[NEIGHBORHOOD]", "[BUSINESS]", "[REVIEW_LINK]"]
        : ["[FIRST_NAME]", "[NAME]", "[SERVICE]", "[BUSINESS]", "[REVIEW_LINK]"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate message";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
