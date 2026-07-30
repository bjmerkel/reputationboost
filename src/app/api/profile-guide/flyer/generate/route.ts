import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/business/active-business";
import { isImageGenerationConfigured } from "@/lib/llm/config";
import { generateAiProfileGuideFlyer } from "@/lib/profile-guide/flyer/generate";
import { profileGuidePublicUrl } from "@/lib/profile-guide/slug";
import { getProfileGuideByBusinessId } from "@/lib/profile-guide/storage";
import { PROFILE_GUIDE_FLYER_TEMPLATES } from "@/lib/profile-guide/theme";
import { getUser } from "@/lib/supabase/server";

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

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const publicUrl = profileGuidePublicUrl(guide.guide.slug, origin);

  try {
    const result = await generateAiProfileGuideFlyer({
      guide,
      business,
      publicUrl,
      template,
    });

    const imageDataUrl = `data:image/png;base64,${result.imageBuffer.toString("base64")}`;

    return NextResponse.json({
      imageDataUrl,
      template: result.template,
      revisedPrompt: result.revisedPrompt ?? null,
      imagePrompt: result.imagePrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate AI flyer";
    const status = /not configured/i.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
