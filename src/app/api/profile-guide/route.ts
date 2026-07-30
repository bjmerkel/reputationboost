import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { getOrCreateProfileGuide, updateProfileGuide } from "@/lib/profile-guide/storage";
import type { ProfileGuideLinkInput, ProfileGuideUpdateInput } from "@/lib/profile-guide/types";
import { profileGuidePublicUrl } from "@/lib/profile-guide/slug";
import { getUser } from "@/lib/supabase/server";

function serializeGuide(data: Awaited<ReturnType<typeof getOrCreateProfileGuide>>) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    guide: {
      id: data.guide.id,
      slug: data.guide.slug,
      displayName: data.guide.display_name,
      published: data.guide.published,
      publishedAt: data.guide.published_at,
      primaryColor: data.guide.primary_color,
      logoUrl: data.guide.logo_url,
      tagline: data.guide.tagline,
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
  return {
    published: typeof record.published === "boolean" ? record.published : undefined,
    primaryColor: typeof record.primaryColor === "string" ? record.primaryColor : undefined,
    logoUrl:
      record.logoUrl === null
        ? null
        : typeof record.logoUrl === "string"
          ? record.logoUrl
          : undefined,
    tagline:
      record.tagline === null
        ? null
        : typeof record.tagline === "string"
          ? record.tagline
          : undefined,
    displayName: typeof record.displayName === "string" ? record.displayName : undefined,
    links: parseLinks(record.links),
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
    return NextResponse.json(serializeGuide(data));
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
    const data = await updateProfileGuide(user.id, business.businessId, parseUpdate(body));
    return NextResponse.json(serializeGuide(data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Profile Guide";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
