import type { ClientConfig } from "@/audit/types";
import { isImageGenerationConfigured } from "@/lib/llm/config";
import type { ProfileGuideFlyerTemplate } from "../theme";
import type { ProfileGuideWithLinks } from "../types";
import { buildFlyerBrief, type FlyerBrief } from "./brief";
import { compositeFlyerImage } from "./composite";
import type { FlyerCopy } from "./copy";
import { resolveFlyerCopy } from "./copy";
import { buildFlyerCopy } from "./copy-builder";
import {
  getFlyerFormatSpec,
  type ProfileGuideFlyerFormat,
} from "./formats";
import { generateFlyerBackgroundImage } from "./generate-image";
import { applyPromptRefinement, bufferToDataUrl, dataUrlToBuffer } from "./helpers";
import {
  DEFAULT_FLYER_DISPLAY_OPTIONS,
  type FlyerDisplayOptions,
} from "./options";
import { buildFlyerImagePrompt } from "./prompt";

export interface GeneratedFlyerResult {
  imageBuffer: Buffer;
  backgroundBuffer: Buffer;
  template: ProfileGuideFlyerTemplate;
  format: ProfileGuideFlyerFormat;
  revisedPrompt?: string;
  imagePrompt: string;
  copy: FlyerCopy;
  recomposedOnly: boolean;
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
  promptRefinement?: string;
  displayOptions?: FlyerDisplayOptions;
  backgroundDataUrl?: string;
  cachedCopy?: FlyerCopy;
  cachedImagePrompt?: string;
}): Promise<GeneratedFlyerResult> {
  if (!isAiFlyerGenerationConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const format = input.format ?? "letter";
  const displayOptions = {
    ...DEFAULT_FLYER_DISPLAY_OPTIONS,
    ...input.displayOptions,
  };
  const brief = buildFlyerBrief(
    input.guide,
    input.business,
    input.publicUrl,
    input.template,
    format,
    displayOptions
  );

  const recomposedOnly = Boolean(input.backgroundDataUrl?.trim());
  if (recomposedOnly) {
    brief.copy =
      input.cachedCopy ??
      resolveFlyerCopy(
        brief.template,
        displayOptions.showTagline ? brief.tagline : null
      );
  } else {
    brief.copy = await buildFlyerCopy(brief);
  }

  const formatSpec = getFlyerFormatSpec(format);
  let background: Buffer;
  let revisedPrompt: string | undefined;
  let imagePrompt = input.cachedImagePrompt ?? "";

  if (recomposedOnly && input.backgroundDataUrl) {
    background = dataUrlToBuffer(input.backgroundDataUrl);
    if (!imagePrompt) {
      imagePrompt = await buildFlyerImagePrompt(brief);
    }
  } else {
    imagePrompt = await buildFlyerImagePrompt(brief);
    imagePrompt = applyPromptRefinement(imagePrompt, input.promptRefinement);
    const generated = await generateFlyerBackgroundImage(imagePrompt, formatSpec);
    background = generated.buffer;
    revisedPrompt = generated.revisedPrompt;
  }

  const imageBuffer = await compositeFlyerImage({ brief, background });

  return {
    imageBuffer,
    backgroundBuffer: background,
    template: input.template,
    format,
    revisedPrompt,
    imagePrompt,
    copy: brief.copy,
    recomposedOnly,
  };
}

export function serializeGeneratedFlyer(result: GeneratedFlyerResult) {
  return {
    imageDataUrl: bufferToDataUrl(result.imageBuffer),
    backgroundDataUrl: bufferToDataUrl(result.backgroundBuffer),
    template: result.template,
    format: result.format,
    revisedPrompt: result.revisedPrompt ?? null,
    imagePrompt: result.imagePrompt,
    copy: result.copy,
    recomposedOnly: result.recomposedOnly,
  };
}

export type { FlyerBrief };
