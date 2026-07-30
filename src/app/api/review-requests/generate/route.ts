import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
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
import { previewReviewEmailContent } from "@/lib/email/template";
import { generateReviewRequestEmail } from "@/lib/llm/review-request-email";
import { generateReviewRequestMessage } from "@/lib/llm/review-request-sms";
import type { OutreachChannel } from "@/lib/review-requests/channel";
import { selectCustomersForGeoCampaign } from "@/lib/review-velocity/geo-router";
import { loadCellLiftAggregatesForUser } from "@/lib/review-velocity/lift-storage";
import { loadKeywordGridsForAudit } from "@/lib/review-velocity/resolve-geo-routing";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
import { profileGuidePublicUrl } from "@/lib/profile-guide/slug";
import { googleReviewUrlForBusiness } from "@/lib/sms/review-link";
import { previewReviewRequestSms } from "@/lib/sms/personalize";
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
      customerId?: string;
      focusKeyword?: string | null;
      channel?: OutreachChannel;
    }>(request);
    const channel: OutreachChannel = body.channel ?? "sms";
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

    const guide = await getProfileGuideByBusinessId(user.id, business.businessId);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const profileGuideUrl =
      guide?.guide.published
        ? `${profileGuidePublicUrl(guide.guide.slug, origin)}?src=outreach`
        : null;

    const outreachReviewUrl = profileGuideUrl ?? reviewUrl;

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
        const liftAggregates = await loadCellLiftAggregatesForUser(business.businessId);
        const geoSelected = selectCustomersForGeoCampaign({
          customers: eligibleCustomers,
          audit,
          keywordGrids,
          batchSize,
          focusKeyword,
          liftAggregates,
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
    const geoOptions = useGeoTemplate
      ? {
          geoTargeted: true,
          neighborhoodLabel:
            geoSample?.service_city?.trim() || business.location.city || undefined,
          promptSeed: focusKeyword ?? undefined,
        }
      : undefined;

    const previewCustomer = geoSample ?? keywordMatchedSample ?? sampleCustomer;
    const previewLocation = {
      city: business.location.city,
      state: business.location.state,
    };
    const previewNeighborhood =
      previewCustomer?.service_city?.trim() || business.location.city || null;

    let template: string;
    let smsTemplate: string | undefined;
    let subject = "How was your experience with [BUSINESS]?";
    let preview: string;
    let smsPreview: string | undefined;
    let previewHtml: string | null = null;

    const buildSmsDraft = async (): Promise<string> => {
      if (audit) {
        return generateReviewRequestMessage(
          audit,
          geoSample ?? keywordMatchedSample ?? undefined,
          focusKeyword,
          geoOptions
        );
      }
      const firstName = keywordMatchedSample?.first_name?.trim() || "[FIRST_NAME]";
      return `Hi ${firstName}! Thanks for choosing [BUSINESS] for [SERVICE]. If your experience was great, a quick Google review would mean a lot: [REVIEW_LINK]`;
    };

    const buildEmailDraft = async (): Promise<{ subject: string; body: string }> => {
      if (audit) {
        const emailDraft = await generateReviewRequestEmail(
          audit,
          geoSample ?? keywordMatchedSample ?? undefined,
          focusKeyword,
          geoOptions
        );
        return { subject: emailDraft.subject, body: emailDraft.body };
      }
      const firstName = keywordMatchedSample?.first_name?.trim() || "[FIRST_NAME]";
      return {
        subject: "We'd love your feedback, [FIRST_NAME]",
        body: `Hi ${firstName},\n\nThank you for choosing [BUSINESS] for [SERVICE]. If your experience was great, would you take a moment to leave us a quick Google review?\n\n[REVIEW_LINK]\n\nThank you,\n[BUSINESS]`,
      };
    };

    if (channel === "auto") {
      const [emailDraft, smsDraft] = await Promise.all([buildEmailDraft(), buildSmsDraft()]);
      subject = emailDraft.subject;
      template = emailDraft.body;
      smsTemplate = smsDraft;

      const emailPreview = previewReviewEmailContent({
        subjectTemplate: subject,
        bodyTemplate: template,
        businessName: business.name,
        reviewUrl: outreachReviewUrl ?? "https://example.com/review",
        customer: previewCustomer,
        focusKeyword,
        neighborhoodLabel: previewNeighborhood,
        location: previewLocation,
      });
      preview = emailPreview.bodyText;
      previewHtml = emailPreview.bodyHtml;
      smsPreview = previewReviewRequestSms({
        template: smsTemplate,
        businessName: business.name,
        reviewUrl: outreachReviewUrl ?? "https://example.com/review",
        customer: previewCustomer,
        focusKeyword,
        neighborhoodLabel: previewNeighborhood,
        location: previewLocation,
      });
    } else if (channel === "email") {
      const emailDraft = await buildEmailDraft();
      subject = emailDraft.subject;
      template = emailDraft.body;

      const emailPreview = previewReviewEmailContent({
        subjectTemplate: subject,
        bodyTemplate: template,
        businessName: business.name,
        reviewUrl: outreachReviewUrl ?? "https://example.com/review",
        customer: previewCustomer,
        focusKeyword,
        neighborhoodLabel: previewNeighborhood,
        location: previewLocation,
      });
      preview = emailPreview.bodyText;
      previewHtml = emailPreview.bodyHtml;
    } else if (audit) {
      template = await buildSmsDraft();
      preview = previewReviewRequestSms({
        template,
        businessName: business.name,
        reviewUrl: outreachReviewUrl ?? "https://example.com/review",
        customer: previewCustomer,
        focusKeyword,
        neighborhoodLabel: previewNeighborhood,
        location: previewLocation,
      });
    } else {
      template = await buildSmsDraft();
      preview = previewReviewRequestSms({
        template,
        businessName: business.name,
        reviewUrl: outreachReviewUrl ?? "https://example.com/review",
        customer: previewCustomer,
        focusKeyword,
        neighborhoodLabel: previewNeighborhood,
        location: previewLocation,
      });
    }

    const emailEligibleCount = eligibleCustomers.filter((customer) => customer.email?.trim()).length;

    return NextResponse.json({
      channel,
      template,
      smsTemplate,
      subject,
      preview,
      smsPreview,
      previewHtml,
      reviewUrl: outreachReviewUrl,
      directReviewUrl: reviewUrl,
      profileGuideUrl,
      emailEligibleCount,
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
