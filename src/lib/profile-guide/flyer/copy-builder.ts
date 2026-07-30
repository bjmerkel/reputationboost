import { completeJson } from "@/lib/llm/client";
import { isLlmConfigured } from "@/lib/llm/config";
import type { FlyerBrief } from "./brief";
import { FLYER_TEMPLATE_COPY, resolveFlyerCopy, type FlyerCopy } from "./copy";

function trimField(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function sanitizeCopy(copy: Partial<FlyerCopy>, brief: FlyerBrief): FlyerCopy {
  const fallback = resolveFlyerCopy(brief.template, brief.tagline);
  return {
    headline: trimField(copy.headline || fallback.headline, 72),
    subhead: trimField(copy.subhead || fallback.subhead, 96),
    cta: trimField(copy.cta || fallback.cta, 96),
  };
}

export async function buildFlyerCopy(brief: FlyerBrief): Promise<FlyerCopy> {
  const fallback = resolveFlyerCopy(brief.template, brief.tagline);
  if (!isLlmConfigured()) {
    return fallback;
  }

  const categoryLine = brief.categories.length
    ? `Categories: ${brief.categories.join(", ")}`
    : "";
  const keywordLine = brief.keywords.length ? `Keywords: ${brief.keywords.join(", ")}` : "";
  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const templateBase = FLYER_TEMPLATE_COPY[brief.template];

  try {
    const result = await completeJson<Partial<FlyerCopy>>(
      [
        {
          role: "system",
          content:
            "You write short, high-converting review-request flyer copy for local businesses. Return JSON with headline, subhead, and cta only.",
        },
        {
          role: "user",
          content: [
            `Business: ${brief.businessName}`,
            `Industry: ${brief.industry}`,
            location ? `Location: ${location}` : "",
            categoryLine,
            keywordLine,
            brief.tagline ? `Tagline: ${brief.tagline}` : "",
            `Tone: ${brief.template}`,
            `Template baseline headline: ${templateBase.headline}`,
            "",
            "Write industry-specific copy encouraging a Google review after a visit.",
            "Headline: punchy, under 8 words. Subhead: scan-to-review instruction. CTA: warm closing line.",
            "Do not mention QR codes explicitly in the subhead if the template already implies scanning.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { temperature: 0.8, maxTokens: 300 }
    );

    return sanitizeCopy(result, brief);
  } catch {
    return fallback;
  }
}
