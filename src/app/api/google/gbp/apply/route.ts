import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import { applyGbpAction, type GbpApplyAction } from "@/lib/google/gbp-apply";
import { getGbpLocationFull, type GbpAttributeUpdate } from "@/lib/google/gbp-location";
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
  "create_post",
  "reply_review",
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
      postSummary?: string;
      reviewId?: string;
      reviewReply?: string;
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
      postSummary: body.postSummary,
      reviewId: body.reviewId,
      reviewReply: body.reviewReply,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GBP apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
