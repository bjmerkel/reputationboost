import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import {
  getProfileGuideFlyerStudio,
  serializeFlyerStudioForClient,
} from "@/lib/profile-guide/flyer/studio-db";
import { loadFlyerStudioContext } from "@/lib/profile-guide/flyer/flyer-context";
import {
  getOrCreateProfileGuide,
  syncProfileGuideFromBusiness,
  updateProfileGuide,
} from "@/lib/profile-guide/storage";
import type { ProfileGuideLinkInput, ProfileGuideUpdateInput } from "@/lib/profile-guide/types";
import { profileGuidePublicUrl } from "@/lib/profile-guide/slug";
import {
  PROFILE_GUIDE_BUTTON_STYLES,
  PROFILE_GUIDE_FONT_PRESETS,
} from "@/lib/profile-guide/theme";
import { getUser } from "@/lib/supabase/server";

function serializeGuide(
  data: Awaited<ReturnType<typeof getOrCreateProfileGuide>>,
  flyerStudio: ReturnType<typeof serializeFlyerStudioForClient> = null,
  flyerContext: Awaited<ReturnType<typeof loadFlyerStudioContext>> | null = null
) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    guide: {
      id: data.guide.id,
      slug: data.guide.slug,
      displayName: data.guide.display_name,
      published: data.guide.published,
      publishedAt: data.guide.published_at,
      primaryColor: data.guide.primary_color,
      backgroundColor: data.guide.background_color,
      buttonStyle: data.guide.button_style,
      fontPreset: data.guide.font_preset,
      logoUrl: data.guide.logo_url,
      backgroundImageUrl: data.guide.background_image_url,
      tagline: data.guide.tagline,
      textMessage: data.guide.text_message,
      gbpSyncedAt: data.guide.gbp_synced_at,
      publicUrl: profileGuidePublicUrl(data.guide.slug, origin),
    },
    links: data.links.map((link) => ({
      id: link.id,
      linkType: link.link_type,
      label: link.label,
      url: link.url,
      sortOrder: link.sort_order,
      enabled: link.enabled,
    })),
    flyerStudio,
    flyerContext,
  };
}

function parseLinks(body: unknown): ProfileGuideLinkInput[] | undefined {
  if (!Array.isArray(body)) return undefined;
  const links: ProfileGuideLinkInput[] = [];
  for (const [index, item] of body.entries()) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const linkType = record.linkType;
    if (typeof linkType !== "string") continue;
    links.push({
      id: typeof record.id === "string" ? record.id : undefined,
      linkType: linkType as ProfileGuideLinkInput["linkType"],
      label: typeof record.label === "string" ? record.label : "",
      url: typeof record.url === "string" ? record.url : "",
      sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : index,
      enabled: Boolean(record.enabled),
    });
  }
  return links;
}

function parseUpdate(body: unknown): ProfileGuideUpdateInput {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;

  const buttonStyle = record.buttonStyle;
  const fontPreset = record.fontPreset;

  return {
    published: typeof record.published === "boolean" ? record.published : undefined,
    primaryColor: typeof record.primaryColor === "string" ? record.primaryColor : undefined,
    backgroundColor: typeof record.backgroundColor === "string" ? record.backgroundColor : undefined,
    buttonStyle:
      typeof buttonStyle === "string" &&
      PROFILE_GUIDE_BUTTON_STYLES.includes(buttonStyle as (typeof PROFILE_GUIDE_BUTTON_STYLES)[number])
        ? (buttonStyle as ProfileGuideUpdateInput["buttonStyle"])
        : undefined,
    fontPreset:
      typeof fontPreset === "string" &&
      PROFILE_GUIDE_FONT_PRESETS.includes(fontPreset as (typeof PROFILE_GUIDE_FONT_PRESETS)[number])
        ? (fontPreset as ProfileGuideUpdateInput["fontPreset"])
        : undefined,
    logoUrl:
      record.logoUrl === null
        ? null
        : typeof record.logoUrl === "string"
          ? record.logoUrl
          : undefined,
    backgroundImageUrl:
      record.backgroundImageUrl === null
        ? null
        : typeof record.backgroundImageUrl === "string"
          ? record.backgroundImageUrl
          : undefined,
    tagline:
      record.tagline === null
        ? null
        : typeof record.tagline === "string"
          ? record.tagline
          : undefined,
    textMessage:
      record.textMessage === null
        ? null
        : typeof record.textMessage === "string"
          ? record.textMessage
          : undefined,
    displayName: typeof record.displayName === "string" ? record.displayName : undefined,
    links: parseLinks(record.links),
    deletedLinkIds: Array.isArray(record.deletedLinkIds)
      ? record.deletedLinkIds.filter((id): id is string => typeof id === "string")
      : undefined,
  };
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  try {
    const data = await getOrCreateProfileGuide(user.id, business);
    const flyerStudio = await getProfileGuideFlyerStudio(user.id, data.guide.id);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const publicUrl = profileGuidePublicUrl(data.guide.slug, origin);
    const flyerContext = await loadFlyerStudioContext({
      userId: user.id,
      guide: data,
      business,
      publicUrl,
      archetypeOverride: flyerStudio?.archetypeOverride ?? null,
      selectedCoverUrl: flyerStudio?.selectedCoverUrl ?? null,
    });
    return NextResponse.json(
      serializeGuide(data, serializeFlyerStudioForClient(flyerStudio), flyerContext)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Profile Guide";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await getOrCreateProfileGuide(user.id, business);
    const data = await updateProfileGuide(
      user.id,
      business.businessId,
      parseUpdate(body),
      business
    );
    const flyerStudio = await getProfileGuideFlyerStudio(user.id, data.guide.id);
    return NextResponse.json(
      serializeGuide(data, serializeFlyerStudioForClient(flyerStudio))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Profile Guide";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action !== "sync") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  try {
    await getOrCreateProfileGuide(user.id, business);
    const data = await syncProfileGuideFromBusiness(user.id, business, { force: true });
    const flyerStudio = await getProfileGuideFlyerStudio(user.id, data.guide.id);
    return NextResponse.json(
      serializeGuide(data, serializeFlyerStudioForClient(flyerStudio))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync Profile Guide";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
