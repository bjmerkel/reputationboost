import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { isImageGenerationConfigured } from "@/lib/llm/config";
import { generateAiProfileGuideFlyer, serializeGeneratedFlyer } from "@/lib/profile-guide/flyer/generate";
import { parseProfileGuideFlyerFormat } from "@/lib/profile-guide/flyer/formats";
import type { FlyerCopy } from "@/lib/profile-guide/flyer/copy";
import { parseFlyerDisplayOptions } from "@/lib/profile-guide/flyer/options";
import { profileGuidePublicUrl } from "@/lib/profile-guide/slug";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
import { PROFILE_GUIDE_FLYER_TEMPLATES } from "@/lib/profile-guide/theme";
import { getUser } from "@/lib/supabase/server";

function parseCachedCopy(value: unknown): FlyerCopy | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.headline !== "string" ||
    typeof record.subhead !== "string" ||
    typeof record.cta !== "string"
  ) {
    return undefined;
  }
  return {
    headline: record.headline,
    subhead: record.subhead,
    cta: record.cta,
    qrLabel: typeof record.qrLabel === "string" ? record.qrLabel : "Scan to leave a Google review",
    supportLine: typeof record.supportLine === "string" ? record.supportLine : "",
  };
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImageGenerationConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  const business = await getActiveBusiness(user.id);
  if (!business?.businessId) {
    return NextResponse.json({ error: "No business configured" }, { status: 400 });
  }

  const guide = await getProfileGuideByBusinessId(user.id, business.businessId);
  if (!guide) {
    return NextResponse.json({ error: "Profile Guide not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const templateParam = typeof record.template === "string" ? record.template : "professional";
  const template = PROFILE_GUIDE_FLYER_TEMPLATES.includes(
    templateParam as (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number]
  )
    ? (templateParam as (typeof PROFILE_GUIDE_FLYER_TEMPLATES)[number])
    : "professional";
  const format = parseProfileGuideFlyerFormat(
    typeof record.format === "string" ? record.format : "letter"
  );
  const promptRefinement =
    typeof record.promptRefinement === "string" ? record.promptRefinement : undefined;
  const displayOptions = parseFlyerDisplayOptions(record.displayOptions);
  const backgroundDataUrl =
    typeof record.backgroundDataUrl === "string" ? record.backgroundDataUrl : undefined;
  const cachedImagePrompt =
    typeof record.imagePrompt === "string" ? record.imagePrompt : undefined;
  const cachedCopy = parseCachedCopy(record.copy);

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const publicUrl = profileGuidePublicUrl(guide.guide.slug, origin);

  try {
    const result = await generateAiProfileGuideFlyer({
      guide,
      business,
      publicUrl,
      template,
      format,
      promptRefinement,
      displayOptions,
      backgroundDataUrl,
      cachedCopy,
      cachedImagePrompt,
    });

    return NextResponse.json(serializeGeneratedFlyer(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate AI flyer";
    const status = /not configured|invalid image data url/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
