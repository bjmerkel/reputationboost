import { isImageGenerationConfigured } from "@/lib/llm/config";
import { buildFlyerBrief, type FlyerBrief } from "./brief";
import { compositeFlyerImage } from "./composite";
import { generateFlyerBackgroundImage } from "./generate-image";
import { buildFlyerImagePrompt } from "./prompt";
import type { ClientConfig } from "@/audit/types";
import type { ProfileGuideFlyerTemplate } from "../theme";
import type { ProfileGuideWithLinks } from "../types";

export interface GeneratedFlyerResult {
  imageBuffer: Buffer;
  template: ProfileGuideFlyerTemplate;
  revisedPrompt?: string;
  imagePrompt: string;
}

export function isAiFlyerGenerationConfigured(): boolean {
  return isImageGenerationConfigured();
}

export async function generateAiProfileGuideFlyer(input: {
  guide: ProfileGuideWithLinks;
  business: ClientConfig;
  publicUrl: string;
  template: ProfileGuideFlyerTemplate;
}): Promise<GeneratedFlyerResult> {
  if (!isAiFlyerGenerationConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const brief = buildFlyerBrief(input.guide, input.business, input.publicUrl, input.template);
  const imagePrompt = await buildFlyerImagePrompt(brief);
  const { buffer: background, revisedPrompt } = await generateFlyerBackgroundImage(imagePrompt);
  const imageBuffer = await compositeFlyerImage({ brief, background });

  return {
    imageBuffer,
    template: input.template,
    revisedPrompt,
    imagePrompt,
  };
}

export type { FlyerBrief };
