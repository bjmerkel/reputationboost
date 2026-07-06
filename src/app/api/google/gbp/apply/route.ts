import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { applyGbpAction, type GbpApplyAction } from "@/lib/google/gbp-apply";
import { getGbpLocationFull, type GbpAttributeUpdate } from "@/lib/google/gbp-location";
import type { GbpMediaCategory, GbpMediaFormat } from "@/lib/google/gbp-media";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

const ACTIONS: GbpApplyAction[] = [
  "update_primary_category",
  "add_secondary_categories",
  "update_description",
  "update_title",
  "update_website",
  "update_phone",
  "add_service_item",
  "update_attributes",
  "enable_recommended_attributes",
  "update_regular_hours",
  "update_holiday_hours",
  "accept_google_suggestion",
  "reject_google_suggestion",
  "sync_nap_field",
  "update_booking_attributes",
  "upload_media",
  "recategorize_media",
  "delete_media",
  "create_post",
  "reply_review",
  "delete_review_reply",
];

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired" }, { status: 401 });
    }

    const full = await getGbpLocationFull(connection);
    return NextResponse.json(full);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load GBP profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      primaryCategory?: string;
      secondaryCategories?: string[];
      description?: string;
      title?: string;
      websiteUri?: string;
      primaryPhone?: string;
      serviceName?: string;
      serviceDescription?: string;
      attributes?: GbpAttributeUpdate[];
      sourceUrl?: string;
      mediaFormat?: GbpMediaFormat;
      category?: GbpMediaCategory;
      postSummary?: string;
      reviewId?: string;
      reviewReply?: string;
      suggestionField?: string;
      preferredValue?: string;
      mediaName?: string;
    };

    if (!body.action || !ACTIONS.includes(body.action as GbpApplyAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const business = await getPrimaryBusiness(user.id);
    if (!business?.gbpConnection) {
      return NextResponse.json({ error: "GBP not connected" }, { status: 400 });
    }

    const connection = await getValidGbpConnection(user.id, business);
    if (!connection) {
      return NextResponse.json({ error: "GBP connection expired. Reconnect in Settings." }, { status: 401 });
    }

    const result = await applyGbpAction(connection, body.action as GbpApplyAction, {
      primaryCategory: body.primaryCategory,
      secondaryCategories: body.secondaryCategories,
      description: body.description,
      title: body.title,
      websiteUri: body.websiteUri,
      primaryPhone: body.primaryPhone,
      serviceName: body.serviceName,
      serviceDescription: body.serviceDescription,
      attributes: body.attributes,
      sourceUrl: body.sourceUrl,
      mediaFormat: body.mediaFormat,
      category: body.category,
      postSummary: body.postSummary,
      reviewId: body.reviewId,
      reviewReply: body.reviewReply,
      suggestionField: body.suggestionField,
      preferredValue: body.preferredValue,
      mediaName: body.mediaName,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GBP apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
