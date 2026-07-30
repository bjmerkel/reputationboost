import type { FlyerBrief } from "./brief";

export function buildFlyerBusinessContext(brief: FlyerBrief): string {
  const location = [brief.city, brief.state].filter(Boolean).join(", ");

  return [
    `Business name: ${brief.businessName}`,
    `Industry: ${brief.industry}`,
    brief.categories.length ? `Categories: ${brief.categories.join(", ")}` : "",
    brief.keywords.length ? `Keywords: ${brief.keywords.join(", ")}` : "",
    location ? `City/region: ${location}` : "",
    brief.address ? `Address: ${brief.address}` : "",
    brief.tagline ? `Tagline: ${brief.tagline}` : "",
    brief.phone ? `Phone: ${brief.phone}` : "",
    brief.website ? `Website: ${brief.website}` : "",
    `Brand colors: primary ${brief.primaryColor}, background ${brief.backgroundColor}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFlyerSupportLine(brief: FlyerBrief): string {
  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const category = brief.categories.slice(0, 2).join(" · ") || brief.industry;
  if (location) return `${category} · ${location}`;
  return category;
}

export function buildFlyerEyebrow(brief: FlyerBrief): string | null {
  if (brief.displayOptions.showTagline && brief.tagline?.trim()) {
    return brief.tagline.trim();
  }
  if (brief.categories.length > 0) {
    return brief.categories.slice(0, 2).join(" · ");
  }
  return brief.industry || null;
}
