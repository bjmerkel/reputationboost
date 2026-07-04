import { NextResponse } from "next/server";
import { getPrimaryBusiness } from "@/audit/businesses";
import {
  analyzeGbpNotificationCoverage,
  formatEnabledNotificationSummary,
} from "@/lib/google/gbp-notifications-coverage";
import {
  clearGbpNotificationSetting,
  getGbpNotificationSetting,
  getGbpPubsubTopic,
  syncRecommendedGbpNotifications,
  updateGbpNotificationSetting,
  type GbpNotificationType,
} from "@/lib/google/gbp-notifications";
import { getValidGbpConnection } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

/** Fetch Pub/Sub notification settings for the connected GBP account. */
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
      return NextResponse.json({ error: "GBP connection expired. Reconnect in Settings." }, { status: 401 });
    }

    const setting = await getGbpNotificationSetting(connection);
    const coverage = analyzeGbpNotificationCoverage(setting);
    const envTopic = getGbpPubsubTopic();

    return NextResponse.json({
      setting,
      coverage,
      envPubsubTopic: envTopic ?? null,
      canAutoConfigure: Boolean(envTopic),
      enabledSummary: formatEnabledNotificationSummary(coverage.enabledTypes),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notification settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Update Pub/Sub notification settings (enable recommended, custom types, or clear). */
export async function PATCH(request: Request) {
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
      return NextResponse.json({ error: "GBP connection expired. Reconnect in Settings." }, { status: 401 });
    }

    const body = (await request.json()) as {
      action?: "enable_recommended" | "clear";
      pubsubTopic?: string;
      notificationTypes?: GbpNotificationType[];
    };

    let setting;
    if (body.action === "clear") {
      setting = await clearGbpNotificationSetting(connection);
    } else if (body.action === "enable_recommended") {
      setting = await syncRecommendedGbpNotifications(connection, body.pubsubTopic);
    } else if (body.notificationTypes || body.pubsubTopic) {
      setting = await updateGbpNotificationSetting(connection, {
        pubsubTopic: body.pubsubTopic,
        notificationTypes: body.notificationTypes,
      });
    } else {
      return NextResponse.json({ error: "action, pubsubTopic, or notificationTypes required" }, { status: 400 });
    }

    const coverage = analyzeGbpNotificationCoverage(setting);
    return NextResponse.json({
      success: true,
      setting,
      coverage,
      enabledSummary: formatEnabledNotificationSummary(coverage.enabledTypes),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notification settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
