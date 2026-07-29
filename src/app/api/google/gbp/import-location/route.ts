import { NextResponse } from "next/server";
import {
  copyGbpTokensFromBusiness,
  createBusiness,
  getBusinessRecord,
  saveGbpLocation,
} from "@/audit/businesses";
import type { GbpConnection } from "@/audit/types";
import { fetchGbpIdentitySnapshot } from "@/lib/google/gbp-identity-snapshot";
import {
  assertLocationAvailable,
  defaultKeywordsFromGbp,
  formatBusinessAddress,
} from "@/lib/google/gbp-import";
import { ensureGbpNotificationSetting } from "@/lib/google/gbp-notifications";
import { getGbpAccessTokenForRecord, getValidGbpConnectionForRecord } from "@/lib/google/token-store";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      sourceBusinessId: string;
      targetBusinessId?: string;
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

    if (!body.sourceBusinessId || !body.accountId || !body.locationId) {
      return NextResponse.json({ error: "Missing import selection" }, { status: 400 });
    }

    const source = await getBusinessRecord(user.id, body.sourceBusinessId);
    if (!source?.gbp_refresh_token) {
      return NextResponse.json(
        { error: "Source Google account is not connected." },
        { status: 400 }
      );
    }

    await assertLocationAvailable(user.id, body.locationId, body.placeId, body.targetBusinessId);

    let businessId = body.targetBusinessId;
    if (businessId) {
      const target = await getBusinessRecord(user.id, businessId);
      if (!target) {
        return NextResponse.json({ error: "Target business not found" }, { status: 404 });
      }
      await copyGbpTokensFromBusiness(user.id, body.sourceBusinessId, businessId);
    } else {
      const industry = body.industry?.trim() || "local business";
      const title = body.title?.trim() || "Imported location";
      const addressParts = (body.address ?? "").split(",").map((part) => part.trim());
      const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : "";
      const stateZip = addressParts[addressParts.length - 1] ?? "";
      const state = stateZip.split(" ")[0] ?? "";

      const created = await createBusiness(user.id, {
        name: title,
        industry,
        location: {
          address: addressParts[0] ?? "",
          city,
          state,
          zip: stateZip.split(" ").slice(1).join(" "),
          lat: 0,
          lng: 0,
        },
        keywords: defaultKeywordsFromGbp(title, industry, city),
        phone: body.phone,
        website: body.website,
        gbpPlaceId: body.placeId,
      });
      businessId = created.businessId!;
      await copyGbpTokensFromBusiness(user.id, body.sourceBusinessId, businessId);
    }

    const business = await getBusinessRecord(user.id, businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found after import setup" }, { status: 500 });
    }

    const accessToken = await getGbpAccessTokenForRecord(business);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to access Google Business Profile for import." },
        { status: 400 }
      );
    }

    const selectedConnection: GbpConnection = {
      businessId,
      accountId: body.accountId,
      locationId: body.locationId,
      placeId: body.placeId ?? business.gbp_place_id ?? undefined,
      googleEmail: business.gbp_google_email ?? undefined,
      accessToken,
      refreshToken: business.gbp_refresh_token!,
      expiresAt: business.gbp_token_expires_at ?? new Date(0).toISOString(),
    };

    const identity = await fetchGbpIdentitySnapshot(selectedConnection).catch((identityError) => {
      console.warn("[gbp-import-location] identity snapshot skipped:", identityError);
      return null;
    });

    const placeId = identity?.placeId || selectedConnection.placeId;
    const businessAddress = formatBusinessAddress(business);

    await saveGbpLocation(user.id, businessId, {
      accountId: body.accountId,
      locationId: body.locationId,
      placeId,
      mapsUrl: identity?.mapsUrl || undefined,
      name: identity?.name || body.title,
      address: identity?.address || body.address || businessAddress,
      phone: identity?.phone || body.phone,
      website: identity?.website || body.website,
      industry: identity?.primaryCategory || body.industry,
      openStatus: identity?.openStatus,
      secondaryCategories: identity?.secondaryCategories,
      serviceArea: identity?.serviceArea,
      businessLatLng: identity?.businessLatLng,
    });

    const updated = await getBusinessRecord(user.id, businessId);
    if (updated) {
      try {
        const connection = await getValidGbpConnectionForRecord(updated);
        if (connection) {
          await ensureGbpNotificationSetting(connection);
        }
      } catch (notifyError) {
        console.warn("[gbp-import-location] notification auto-config skipped:", notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      businessId,
      googleEmail: updated?.gbp_google_email ?? source.gbp_google_email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import location";
    const status = message.includes("already in your portfolio") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
