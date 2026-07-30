import { completeText } from "@/lib/llm/client";
import { isLlmConfigured } from "@/lib/llm/config";
import type { FlyerBrief } from "./brief";
import { buildFlyerBusinessContext } from "./context";
import { getFlyerFormatSpec } from "./formats";

const TEMPLATE_STYLE: Record<FlyerBrief["template"], string> = {
  professional: "polished, trustworthy, premium local business marketing",
  friendly: "warm, welcoming, family-friendly and upbeat",
  bold: "bold, high-impact, confident and energetic",
};

function formatDescriptor(brief: FlyerBrief): string {
  const spec = getFlyerFormatSpec(brief.format);
  if (spec.orientation === "landscape") {
    return "landscape professional print flyer";
  }
  if (brief.format === "story") {
    return "vertical social-media story flyer";
  }
  return "portrait professional print flyer";
}

export function buildFallbackFlyerImagePrompt(brief: FlyerBrief): string {
  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const categoryHint = brief.categories.length ? brief.categories.join(", ") : brief.industry;

  return [
    `Create a subtle, premium ${formatDescriptor(brief)} backdrop for "${brief.businessName}", a ${brief.industry} business`,
    location ? `in ${location}` : "",
    `using brand colors ${brief.primaryColor} and ${brief.backgroundColor}.`,
    `Mood should feel appropriate for ${categoryHint} without literal illustrations.`,
    `Style: ${TEMPLATE_STYLE[brief.template]}.`,
    "Use only a soft gradient, gentle lighting, and very light abstract texture.",
    "Do NOT include text, logos, QR codes, icons, clipart, toys, children, faces, objects, mascots, borders, frames, or busy patterns.",
    "The result should look like a clean corporate print template background ready for typography and a QR code overlay.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function buildFlyerImagePrompt(brief: FlyerBrief): Promise<string> {
  if (!isLlmConfigured()) {
    return buildFallbackFlyerImagePrompt(brief);
  }

  const spec = getFlyerFormatSpec(brief.format);

  try {
    const prompt = await completeText(
      [
        {
          role: "system",
          content:
            "You write image prompts for gpt-image-2 that produce subtle, professional print flyer backgrounds. The business will overlay its real logo, text, and QR code later. Return only the prompt text.",
        },
        {
          role: "user",
          content: [
            buildFlyerBusinessContext(brief),
            `Style: ${brief.template} (${TEMPLATE_STYLE[brief.template]})`,
            `Format: ${spec.label} (${spec.description}, ${spec.orientation})`,
            brief.coverImageUrl ? "A real cover photo will be placed separately at the top." : "",
            "",
            `Write one detailed prompt for a ${formatDescriptor(brief)} BACKGROUND ONLY.`,
            "Requirements:",
            "- premium local business flyer backdrop",
            "- soft brand-colored gradient and minimal abstract texture",
            "- NO text, logos, QR codes, icons, clipart, people, products, toys, or decorative objects",
            "- NO busy patterns or childish illustrations",
            "- full-bleed, clean, professional, ready for typography overlay",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { temperature: 0.5, maxTokens: 500 }
    );

    return prompt.trim() || buildFallbackFlyerImagePrompt(brief);
  } catch {
    return buildFallbackFlyerImagePrompt(brief);
  }
}
