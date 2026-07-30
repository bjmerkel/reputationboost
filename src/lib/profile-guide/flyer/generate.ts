import type { ClientConfig } from "@/audit/types";
import { isImageGenerationConfigured } from "@/lib/llm/config";
import type { ProfileGuideFlyerTemplate } from "../theme";
import type { ProfileGuideWithLinks } from "../types";
import { buildFlyerDesignBriefWithEnrichment } from "./design-brief";
import type { FlyerDesignArchetype } from "./archetypes";
import { compositeFlyerImage } from "./composite";
import type { FlyerCopy } from "./copy";
import { resolveFlyerCopy } from "./copy";
import { buildFlyerCopy } from "./copy-builder";
import { buildFlyerSupportLine } from "./context";
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
import { FLYER_PROMPT_VERSION } from "./prompt-version";
import { checkFlyerQuality, type FlyerQualityReport } from "./quality-check";

export interface GeneratedFlyerResult {
  imageBuffer: Buffer;
  backgroundBuffer: Buffer;
  template: ProfileGuideFlyerTemplate;
  format: ProfileGuideFlyerFormat;
  revisedPrompt?: string;
  imagePrompt: string;
  copy: FlyerCopy;
  recomposedOnly: boolean;
  archetype: FlyerDesignArchetype;
  archetypeLabel: string;
  promptVersion: string;
  quality: FlyerQualityReport;
}

export function isAiFlyerGenerationConfigured(): boolean {
  return isImageGenerationConfigured();
}

export async function generateAiProfileGuideFlyer(input: {
  userId: string;
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
  archetypeOverride?: FlyerDesignArchetype | null;
  selectedCoverUrl?: string | null;
}): Promise<GeneratedFlyerResult> {
  if (!isAiFlyerGenerationConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const format = input.format ?? "letter";
  const displayOptions = {
    ...DEFAULT_FLYER_DISPLAY_OPTIONS,
    ...input.displayOptions,
  };
  const designBrief = await buildFlyerDesignBriefWithEnrichment({
    userId: input.userId,
    guide: input.guide,
    business: input.business,
    publicUrl: input.publicUrl,
    template: input.template,
    format,
    displayOptions,
    archetypeOverride: input.archetypeOverride,
    selectedCoverUrl: input.selectedCoverUrl,
  });

  const recomposedOnly = Boolean(input.backgroundDataUrl?.trim());
  if (recomposedOnly) {
    designBrief.copy =
      input.cachedCopy ??
      resolveFlyerCopy(
        designBrief.template,
        displayOptions.showTagline ? designBrief.tagline : null,
        buildFlyerSupportLine(designBrief)
      );
  } else {
    designBrief.copy = await buildFlyerCopy(designBrief);
  }

  const formatSpec = getFlyerFormatSpec(format);
  let background: Buffer;
  let revisedPrompt: string | undefined;
  let imagePrompt = input.cachedImagePrompt ?? "";

  if (recomposedOnly && input.backgroundDataUrl) {
    background = dataUrlToBuffer(input.backgroundDataUrl);
    if (!imagePrompt) {
      imagePrompt = await buildFlyerImagePrompt(designBrief);
    }
  } else {
    imagePrompt = await buildFlyerImagePrompt(designBrief);
    imagePrompt = applyPromptRefinement(imagePrompt, input.promptRefinement);
    const generated = await generateFlyerBackgroundImage(imagePrompt, formatSpec);
    background = generated.buffer;
    revisedPrompt = generated.revisedPrompt;
  }

  const imageBuffer = await compositeFlyerImage({ brief: designBrief, background });
  const quality = checkFlyerQuality({ brief: designBrief, copy: designBrief.copy });

  return {
    imageBuffer,
    backgroundBuffer: background,
    template: input.template,
    format,
    revisedPrompt,
    imagePrompt,
    copy: designBrief.copy,
    recomposedOnly,
    archetype: designBrief.archetype,
    archetypeLabel: designBrief.archetypeStyle.label,
    promptVersion: FLYER_PROMPT_VERSION,
    quality,
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
    archetype: result.archetype,
    archetypeLabel: result.archetypeLabel,
    promptVersion: result.promptVersion,
    quality: result.quality,
  };
}

export type { FlyerBrief } from "./brief";
export type { FlyerDesignBrief } from "./design-brief";
