import { completeText } from "@/lib/llm/client";
import { isLlmConfigured } from "@/lib/llm/config";
import type { FlyerBrief } from "./brief";
import { getFlyerFormatSpec } from "./formats";

const TEMPLATE_STYLE: Record<FlyerBrief["template"], string> = {
  professional: "clean, trustworthy, premium local business marketing",
  friendly: "warm, welcoming, approachable and upbeat",
  bold: "high-impact, energetic, strong contrast and confident",
};

function formatDescriptor(brief: FlyerBrief): string {
  const spec = getFlyerFormatSpec(brief.format);
  if (spec.orientation === "landscape") {
    return "landscape postcard-style composition";
  }
  if (brief.format === "story") {
    return "tall vertical social-media story composition";
  }
  return "portrait print flyer composition";
}

export function buildFallbackFlyerImagePrompt(brief: FlyerBrief): string {
  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const categoryHint = brief.categories.length ? brief.categories.join(", ") : brief.industry;
  const keywordHint = brief.keywords.length ? ` Themes: ${brief.keywords.join(", ")}.` : "";

  return [
    `Design a ${formatDescriptor(brief)} background for "${brief.businessName}", a ${brief.industry} business`,
    location ? `in ${location}` : "",
    `using brand colors ${brief.primaryColor} and ${brief.backgroundColor}.`,
    `Visual cues for ${categoryHint}.${keywordHint}`,
    `Style: ${TEMPLATE_STYLE[brief.template]}.`,
    "Include subtle industry-relevant atmosphere and elegant marketing polish.",
    "Do not include any text, logos, QR codes, watermarks, or readable words.",
    "Leave generous clean space for overlays in the center and lower third.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function buildFlyerImagePrompt(brief: FlyerBrief): Promise<string> {
  if (!isLlmConfigured()) {
    return buildFallbackFlyerImagePrompt(brief);
  }

  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const spec = getFlyerFormatSpec(brief.format);

  try {
    const prompt = await completeText(
      [
        {
          role: "system",
          content:
            "You write concise prompts for gpt-image-2 to generate marketing flyer backgrounds. Return only the image prompt text with no markdown.",
        },
        {
          role: "user",
          content: [
            `Business: ${brief.businessName}`,
            `Industry: ${brief.industry}`,
            brief.categories.length ? `Categories: ${brief.categories.join(", ")}` : "",
            brief.keywords.length ? `Keywords: ${brief.keywords.join(", ")}` : "",
            location ? `Location: ${location}` : "",
            `Brand colors: primary ${brief.primaryColor}, background ${brief.backgroundColor}`,
            `Style: ${brief.template} (${TEMPLATE_STYLE[brief.template]})`,
            `Format: ${spec.label} (${spec.description}, ${spec.orientation})`,
            brief.tagline ? `Tagline context: ${brief.tagline}` : "",
            brief.coverImageUrl ? "They have a storefront/cover photo to feature." : "",
            "",
            `Write one detailed image-generation prompt for a ${formatDescriptor(brief)} review-request flyer BACKGROUND only.`,
            "Requirements: no text, no logos, no QR codes, leave open space for overlays, high-end local marketing look.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { temperature: 0.7, maxTokens: 500 }
    );

    return prompt.trim() || buildFallbackFlyerImagePrompt(brief);
  } catch {
    return buildFallbackFlyerImagePrompt(brief);
  }
}
