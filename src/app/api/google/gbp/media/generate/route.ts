import { NextResponse } from "next/server";
import type { GbpMediaCategory } from "@/lib/google/gbp-media";
import { generateGbpPhotoImage } from "@/lib/llm/gbp-photos";
import { isImageGenerationConfigured } from "@/lib/llm/config";
import { getUser } from "@/lib/supabase/server";

/** Preview AI photo generation (returns base64 data URL). */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImageGenerationConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      prompt?: string;
      category?: GbpMediaCategory;
    };

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const { bytes, contentType, revisedPrompt } = await generateGbpPhotoImage(body.prompt);
    const base64 = Buffer.from(bytes).toString("base64");

    return NextResponse.json({
      previewDataUrl: `data:${contentType};base64,${base64}`,
      revisedPrompt,
      category: body.category ?? "ADDITIONAL",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
