import { completeJson } from "@/lib/llm/client";
import { isLlmConfigured } from "@/lib/llm/config";
import type { FlyerDesignBrief } from "./design-brief";
import { FLYER_COPY_SYSTEM_PROMPT } from "./design-system";
import { buildFlyerSupportLine } from "./context";
import { FLYER_TEMPLATE_COPY, resolveFlyerCopy, type FlyerCopy } from "./copy";
import { buildFlyerCopyPromptTemplate } from "./prompt-template";

function trimField(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function sanitizeCopy(copy: Partial<FlyerCopy>, brief: FlyerDesignBrief): FlyerCopy {
  const fallback = resolveFlyerCopy(
    brief.template,
    brief.displayOptions.showTagline ? brief.tagline : null,
    buildFlyerSupportLine(brief)
  );

  return {
    headline: trimField(copy.headline || fallback.headline, 72),
    subhead: trimField(copy.subhead || fallback.subhead, 110),
    cta: trimField(copy.cta || fallback.cta, 110),
    qrLabel: trimField(copy.qrLabel || fallback.qrLabel, 64),
    supportLine: trimField(copy.supportLine || fallback.supportLine, 96),
  };
}

export async function buildFlyerCopy(brief: FlyerDesignBrief): Promise<FlyerCopy> {
  const fallback = resolveFlyerCopy(
    brief.template,
    brief.displayOptions.showTagline ? brief.tagline : null,
    buildFlyerSupportLine(brief)
  );

  if (!isLlmConfigured()) {
    return fallback;
  }

  const templateBase = FLYER_TEMPLATE_COPY[brief.template];

  try {
    const result = await completeJson<Partial<FlyerCopy>>(
      [
        {
          role: "system",
          content: FLYER_COPY_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            buildFlyerCopyPromptTemplate(brief),
            `Baseline headline: ${templateBase.headline}`,
          ].join("\n\n"),
        },
      ],
      { temperature: 0.65, maxTokens: 400 }
    );

    return sanitizeCopy(result, brief);
  } catch {
    return fallback;
  }
}
