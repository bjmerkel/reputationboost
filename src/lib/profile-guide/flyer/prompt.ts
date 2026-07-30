import { completeText } from "@/lib/llm/client";
import { isLlmConfigured } from "@/lib/llm/config";
import type { FlyerDesignBrief } from "./design-brief";
import { FLYER_DESIGN_SYSTEM_PROMPT, FLYER_IMAGE_NEVER_DO_RULES } from "./design-system";
import { getFlyerFormatSpec } from "./formats";
import { buildFlyerBackgroundPromptTemplate } from "./prompt-template";

export function buildFallbackFlyerImagePrompt(brief: FlyerDesignBrief): string {
  return buildFlyerBackgroundPromptTemplate(brief);
}

export async function buildFlyerImagePrompt(brief: FlyerDesignBrief): Promise<string> {
  const templatePrompt = buildFlyerBackgroundPromptTemplate(brief);

  if (!isLlmConfigured()) {
    return templatePrompt;
  }

  const spec = getFlyerFormatSpec(brief.format);

  try {
    const prompt = await completeText(
      [
        {
          role: "system",
          content: `${FLYER_DESIGN_SYSTEM_PROMPT}

You convert structured flyer briefs into a single gpt-image-2 background prompt.
Return only the final image prompt text. Preserve all NEVER rules.`,
        },
        {
          role: "user",
          content: [
            templatePrompt,
            "",
            `Format: ${spec.label} (${spec.description}, ${spec.orientation})`,
            "",
            "Rewrite the brief above into one detailed gpt-image-2 BACKGROUND prompt.",
            "Keep the archetype mood and industry-specific direction.",
            "Preserve these constraints:",
            FLYER_IMAGE_NEVER_DO_RULES,
          ].join("\n"),
        },
      ],
      { temperature: 0.45, maxTokens: 700 }
    );

    return prompt.trim() || templatePrompt;
  } catch {
    return templatePrompt;
  }
}
