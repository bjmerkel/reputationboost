import { completeJson } from "@/lib/llm/client";
import { isLlmConfigured } from "@/lib/llm/config";
import type { FlyerBrief } from "./brief";
import { buildFlyerBusinessContext, buildFlyerSupportLine } from "./context";
import { FLYER_TEMPLATE_COPY, resolveFlyerCopy, type FlyerCopy } from "./copy";

function trimField(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function sanitizeCopy(copy: Partial<FlyerCopy>, brief: FlyerBrief): FlyerCopy {
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

export async function buildFlyerCopy(brief: FlyerBrief): Promise<FlyerCopy> {
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
          content:
            "You write polished review-request flyer copy for local businesses. Return JSON with headline, subhead, cta, qrLabel, and supportLine.",
        },
        {
          role: "user",
          content: [
            buildFlyerBusinessContext(brief),
            `Tone: ${brief.template}`,
            `Baseline headline: ${templateBase.headline}`,
            "",
            "Write copy for a professional printed review flyer.",
            "Use the real business details above. Mention the city or service type when helpful.",
            "headline: bold, under 8 words.",
            "subhead: one sentence about leaving a Google review.",
            "cta: warm closing line.",
            "qrLabel: short scan instruction above the QR code.",
            "supportLine: one line with industry/service plus city or neighborhood.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { temperature: 0.7, maxTokens: 400 }
    );

    return sanitizeCopy(result, brief);
  } catch {
    return fallback;
  }
}
