import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBusinessRecord, saveGbpLocation, saveGbpTokens } from "@/audit/businesses";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { getGoogleTokenEmail } from "@/lib/google/gbp-access";
import { listAllGbpLocations } from "@/lib/google/gbp-accounts";
import {
  bestAutoConnectLocation,
  rankGbpLocationsForBusiness,
} from "@/lib/google/gbp-onboarding-match";
import { ensureGbpNotificationSetting } from "@/lib/google/gbp-notifications";
import { fetchGbpIdentitySnapshot } from "@/lib/google/gbp-identity-snapshot";
import type { GbpConnection } from "@/audit/types";

interface OAuthStateCookie {
  state: string;
  businessId: string;
  userId: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${siteUrl}/platform/onboard?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${siteUrl}/platform/onboard?error=missing_code`);
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get("gbp_oauth_state")?.value;
  cookieStore.delete("gbp_oauth_state");

  if (!raw) {
    return NextResponse.redirect(`${siteUrl}/platform/onboard?error=invalid_state`);
  }

  let parsed: OAuthStateCookie;
  try {
    parsed = JSON.parse(raw) as OAuthStateCookie;
  } catch {
    return NextResponse.redirect(`${siteUrl}/platform/onboard?error=invalid_state`);
  }

  if (parsed.state !== state) {
    return NextResponse.redirect(`${siteUrl}/platform/onboard?error=state_mismatch`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refreshToken) {
      return NextResponse.redirect(
        `${siteUrl}/platform/onboard?businessId=${parsed.businessId}&error=no_refresh_token`
      );
    }

    const googleEmail = await getGoogleTokenEmail(tokens.accessToken);

    await saveGbpTokens(parsed.userId, parsed.businessId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      googleEmail,
    });

    const locations = await listAllGbpLocations(tokens.accessToken);
    const business = await getBusinessRecord(parsed.userId, parsed.businessId);
    const address = business?.location
      ? [
          business.location.address,
          business.location.city,
          business.location.state,
          business.location.zip,
        ]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const ranked = await rankGbpLocationsForBusiness(tokens.accessToken, locations, {
      name: business?.name ?? "",
      placeId: business?.gbp_place_id,
      address,
    });

    const auto = bestAutoConnectLocation(ranked);
    if (auto) {
      const connection: GbpConnection = {
        businessId: parsed.businessId,
        accountId: auto.accountId,
        locationId: auto.locationId,
        placeId: auto.placeId ?? business?.gbp_place_id ?? undefined,
        googleEmail,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      };
      const identity = await fetchGbpIdentitySnapshot(connection).catch((identityError) => {
        console.warn("[gbp-oauth] identity snapshot skipped:", identityError);
        return null;
      });

      await saveGbpLocation(parsed.userId, parsed.businessId, {
        accountId: auto.accountId,
        locationId: auto.locationId,
        placeId: identity?.placeId || connection.placeId,
        mapsUrl: identity?.mapsUrl || undefined,
        name: identity?.name || auto.title,
        address: identity?.address || auto.address,
        phone: identity?.phone || auto.phone,
        website: identity?.website || auto.website,
        industry: identity?.primaryCategory || auto.primaryCategory,
        openStatus: identity?.openStatus,
        secondaryCategories: identity?.secondaryCategories,
        serviceArea: identity?.serviceArea,
        businessLatLng: identity?.businessLatLng,
      });

      try {
        await ensureGbpNotificationSetting({
          ...connection,
          placeId: identity?.placeId || connection.placeId,
        });
      } catch (notifyError) {
        console.warn("[gbp-oauth] notification auto-config skipped:", notifyError);
      }

      return NextResponse.redirect(`${siteUrl}/platform/audit?onboarded=1`);
    }

    const locationPayload = Buffer.from(JSON.stringify(ranked)).toString("base64url");
    return NextResponse.redirect(
      `${siteUrl}/platform/onboard?step=location&businessId=${parsed.businessId}&locations=${locationPayload}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      `${siteUrl}/platform/onboard?error=${encodeURIComponent(message)}`
    );
  }
}
