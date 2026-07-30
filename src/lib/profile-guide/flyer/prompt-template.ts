import type { FlyerDesignBrief } from "./design-brief";
import {
  FLYER_DESIGN_SYSTEM_PROMPT,
  FLYER_IMAGE_NEVER_DO_RULES,
  FLYER_IMAGE_QUALITY_ENDING,
} from "./design-system";
import { getFlyerFormatSpec } from "./formats";

function formatRatingLine(brief: FlyerDesignBrief): string {
  if (brief.averageRating == null || brief.reviewCount == null || brief.reviewCount <= 0) {
    return "Not available";
  }
  return `${brief.averageRating.toFixed(1)} stars (${brief.reviewCount} Google reviews)`;
}

function formatAssetsSection(brief: FlyerDesignBrief): string {
  const assets = [
    brief.logoUrl ? "Business logo (composited separately)" : null,
    brief.coverImageUrl ? "Cover photo (composited separately)" : null,
    brief.photoUrls.length ? `${brief.photoUrls.length} Google business photos available` : null,
    "QR code (composited separately)",
    "Typography and contact details (composited separately)",
  ].filter(Boolean);

  return assets.join("\n");
}

export function buildFlyerBackgroundPromptTemplate(brief: FlyerDesignBrief): string {
  const spec = getFlyerFormatSpec(brief.format);
  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const style = brief.archetypeStyle;

  return [
    FLYER_DESIGN_SYSTEM_PROMPT,
    "",
    `Create a premium ${spec.label.toLowerCase()} (${spec.description}) flyer BACKGROUND ONLY for:`,
    "",
    `Business Name: ${brief.businessName}`,
    `Business Category: ${brief.primaryCategory}`,
    `Industry: ${brief.industry}`,
    brief.categories.length ? `Additional Categories: ${brief.categories.join(", ")}` : "",
    location ? `Location: ${location}` : "",
    `Brand Colors: ${brief.primaryColor} and ${brief.backgroundColor}`,
    brief.description ? `Business Description: ${brief.description}` : "",
    `Google Rating: ${formatRatingLine(brief)}`,
    brief.phone ? `Phone: ${brief.phone}` : "",
    brief.address ? `Address: ${brief.address}` : "",
    brief.website ? `Website: ${brief.website}` : "",
    brief.tagline ? `Tagline: ${brief.tagline}` : "",
  brief.profileGuideActions.length
      ? `Profile Guide Actions: ${brief.profileGuideActions.join(", ")}`
      : "",
    "",
    `Design Archetype: ${style.label}`,
    `Archetype Mood: ${style.mood}`,
    `Archetype Palette: ${style.palette}`,
    `Archetype Typography Energy: ${style.typography}`,
    `Background Treatment: ${style.backgroundTreatment}`,
    `Texture Direction: ${style.texture}`,
    `Template Tone: ${brief.template}`,
    "",
    "Design Goal:",
    "Encourage customers already inside the business to scan the QR code.",
    "The QR opens a branded Profile Guide where customers can leave a Google review, get directions, call, visit the website, or book.",
    "",
    "Composition guidance (atmospheric only — all logo, copy, and QR are composited later):",
    "• Upper third: breathable open atmosphere for logo overlap; no drawn panel, badge, or card",
    "• Middle: gradients, texture, or soft photo atmosphere only; never a white rectangle or content card",
    "• Lower third: visually calm and uncluttered for a composited QR code; never draw a square, frame, placeholder box, or shadow panel",
    "Keep the full background as one continuous premium atmosphere. Overlays must sit directly on color/texture — not inside AI-drawn boxes.",
    "",
    "Assets Available (DO NOT draw these in the image):",
    formatAssetsSection(brief),
    "",
    "Creative Direction:",
    "Create a premium marketing composition using professional layout principles.",
    "The background should feel unique to this business while maintaining excellent readability for overlaid content.",
    "Use asymmetrical balance, depth, layered atmosphere, and subtle visual effects where appropriate.",
    "Avoid generic templates and avoid AI-artifacts.",
    "",
    FLYER_IMAGE_NEVER_DO_RULES,
    "",
    FLYER_IMAGE_QUALITY_ENDING,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFlyerCopyPromptTemplate(brief: FlyerDesignBrief): string {
  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const style = brief.archetypeStyle;

  return [
    `Business: ${brief.businessName}`,
    `Category: ${brief.primaryCategory}`,
    `Industry: ${brief.industry}`,
    location ? `Location: ${location}` : "",
    brief.description ? `Description: ${brief.description}` : "",
    formatRatingLine(brief) !== "Not available" ? `Rating: ${formatRatingLine(brief)}` : "",
    brief.tagline ? `Tagline: ${brief.tagline}` : "",
    `Archetype: ${style.label}`,
    `Copy tone: ${style.copyTone}`,
    `Example headlines: ${style.headlineExamples.join(" | ")}`,
    `Template tone: ${brief.template}`,
    "",
    "Write copy for a professional printed review flyer.",
    "Use the real business details above. Mention city or service type when helpful.",
    "If rating/review count is strong, reference social proof naturally in the subhead.",
    "headline: bold, under 8 words, specific to this business.",
    "subhead: one sentence encouraging a Google review.",
    "cta: warm closing line.",
    "qrLabel: short scan instruction (e.g. Scan with your phone).",
    "supportLine: one line with industry/service plus city or neighborhood.",
  ]
    .filter(Boolean)
    .join("\n");
}
