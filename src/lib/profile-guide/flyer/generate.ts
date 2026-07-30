import type { ClientConfig } from "@/audit/types";
import { isImageGenerationConfigured } from "@/lib/llm/config";
import type { ProfileGuideFlyerTemplate } from "../theme";
import type { ProfileGuideWithLinks } from "../types";
import { buildFlyerBrief, type FlyerBrief } from "./brief";
import { compositeFlyerImage } from "./composite";
import { buildFlyerCopy } from "./copy-builder";
import {
  getFlyerFormatSpec,
  type ProfileGuideFlyerFormat,
} from "./formats";
import { generateFlyerBackgroundImage } from "./generate-image";
import { buildFlyerImagePrompt } from "./prompt";

export interface GeneratedFlyerResult {
  imageBuffer: Buffer;
  template: ProfileGuideFlyerTemplate;
  format: ProfileGuideFlyerFormat;
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
  format?: ProfileGuideFlyerFormat;
}): Promise<GeneratedFlyerResult> {
  if (!isAiFlyerGenerationConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const format = input.format ?? "letter";
  const brief = buildFlyerBrief(
    input.guide,
    input.business,
    input.publicUrl,
    input.template,
    format
  );
  brief.copy = await buildFlyerCopy(brief);

  const formatSpec = getFlyerFormatSpec(format);
  const imagePrompt = await buildFlyerImagePrompt(brief);
  const { buffer: background, revisedPrompt } = await generateFlyerBackgroundImage(
    imagePrompt,
    formatSpec
  );
  const imageBuffer = await compositeFlyerImage({ brief, background });

  return {
    imageBuffer,
    template: input.template,
    format,
    revisedPrompt,
    imagePrompt,
  };
}

export type { FlyerBrief };
