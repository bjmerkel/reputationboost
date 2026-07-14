import { NextResponse } from "next/server";
import { getBusinessRecord, saveGbpLocation } from "@/audit/businesses";
import type { GbpConnection } from "@/audit/types";
import { fetchGbpIdentitySnapshot } from "@/lib/google/gbp-identity-snapshot";
import { validateGbpLocationSelection } from "@/lib/google/gbp-onboarding-match";
import { getGbpAccessTokenForRecord, getValidGbpConnectionForRecord } from "@/lib/google/token-store";
import { ensureGbpNotificationSetting } from "@/lib/google/gbp-notifications";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      businessId: string;
      accountId: string;
      locationId: string;
      placeId?: string;
      title?: string;
      phone?: string;
      website?: string;
      industry?: string;
      address?: string;
      parentChainId?: string;
      chainDisplayName?: string;
    };

    if (!body.businessId || !body.accountId || !body.locationId) {
      return NextResponse.json({ error: "Missing location selection" }, { status: 400 });
    }

    const business = await getBusinessRecord(user.id, body.businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const accessToken = await getGbpAccessTokenForRecord(business);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Google Business Profile is not connected. Reconnect and try again." },
        { status: 400 }
      );
    }

    const businessAddress = business.location
      ? [
          business.location.address,
          business.location.city,
          business.location.state,
          business.location.zip,
        ]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const validation = await validateGbpLocationSelection(
      accessToken,
      {
        name: `locations/${body.locationId}`,
        locationId: body.locationId,
        accountId: body.accountId,
        title: body.title ?? "Selected location",
        address: body.address ?? businessAddress ?? "",
        phone: body.phone ?? "",
        website: body.website ?? "",
        placeId: body.placeId,
        primaryCategory: body.industry ?? business.industry,
        parentChainId: body.parentChainId,
        chainDisplayName: body.chainDisplayName,
      },
      {
        name: business.name,
        placeId: business.gbp_place_id,
        address: businessAddress,
      }
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.warning ?? "Selected location does not match your business." },
        { status: 400 }
      );
    }

    const selectedConnection: GbpConnection = {
      businessId: body.businessId,
      accountId: body.accountId,
      locationId: body.locationId,
      placeId: body.placeId ?? business.gbp_place_id ?? undefined,
      googleEmail: business.gbp_google_email ?? undefined,
      accessToken,
      refreshToken: business.gbp_refresh_token!,
      expiresAt: business.gbp_token_expires_at ?? new Date(0).toISOString(),
    };
    const identity = await fetchGbpIdentitySnapshot(selectedConnection).catch((identityError) => {
      console.warn("[gbp-select-location] identity snapshot skipped:", identityError);
      return null;
    });
    const placeId = identity?.placeId || selectedConnection.placeId;

    await saveGbpLocation(user.id, body.businessId, {
      accountId: body.accountId,
      locationId: body.locationId,
      placeId,
      mapsUrl: identity?.mapsUrl || undefined,
      name: identity?.name || body.title,
      address: identity?.address || body.address,
      phone: identity?.phone || body.phone,
      website: identity?.website || body.website,
      industry: identity?.primaryCategory || body.industry,
      openStatus: identity?.openStatus,
      secondaryCategories: identity?.secondaryCategories,
      serviceArea: identity?.serviceArea,
      businessLatLng: identity?.businessLatLng,
    });

    const updated = await getBusinessRecord(user.id, body.businessId);
    if (updated) {
      try {
        const connection = await getValidGbpConnectionForRecord(updated);
        if (connection) {
          await ensureGbpNotificationSetting(connection);
        }
      } catch (notifyError) {
        console.warn("[gbp-select-location] notification auto-config skipped:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      warning: validation.warning,
      matchScore: validation.matchScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save location";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
