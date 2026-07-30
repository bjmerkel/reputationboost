import type { FlyerBrief } from "./brief";
import type { FlyerDesignBrief } from "./design-brief";

type BriefLike = FlyerBrief | FlyerDesignBrief;

function isDesignBrief(brief: BriefLike): brief is FlyerDesignBrief {
  return "archetype" in brief && "primaryCategory" in brief;
}

export function buildFlyerBusinessContext(brief: BriefLike): string {
  const location = [brief.city, brief.state].filter(Boolean).join(", ");

  const lines = [
    `Business name: ${brief.businessName}`,
    `Industry: ${brief.industry}`,
    isDesignBrief(brief) ? `Primary category: ${brief.primaryCategory}` : "",
    brief.categories.length ? `Categories: ${brief.categories.join(", ")}` : "",
    brief.keywords.length ? `Keywords: ${brief.keywords.join(", ")}` : "",
    location ? `City/region: ${location}` : "",
    brief.address ? `Address: ${brief.address}` : "",
    brief.tagline ? `Tagline: ${brief.tagline}` : "",
    brief.phone ? `Phone: ${brief.phone}` : "",
    brief.website ? `Website: ${brief.website}` : "",
    `Brand colors: primary ${brief.primaryColor}, background ${brief.backgroundColor}`,
  ];

  if (isDesignBrief(brief)) {
    lines.push(
      brief.description ? `Description: ${brief.description}` : "",
      brief.averageRating != null && brief.reviewCount != null
        ? `Google rating: ${brief.averageRating} (${brief.reviewCount} reviews)`
        : "",
      brief.profileGuideActions.length
        ? `Profile Guide actions: ${brief.profileGuideActions.join(", ")}`
        : "",
      brief.photoUrls.length ? `Photo assets available: ${brief.photoUrls.length}` : "",
      `Design archetype: ${brief.archetypeStyle.label}`,
      `Archetype mood: ${brief.archetypeStyle.mood}`
    );
  }

  return lines.filter(Boolean).join("\n");
}

export function buildFlyerSupportLine(brief: BriefLike): string {
  const location = [brief.city, brief.state].filter(Boolean).join(", ");
  const category =
    (isDesignBrief(brief) ? brief.primaryCategory : brief.categories[0]) ||
    brief.industry;
  if (location) return `${category} · ${location}`;
  return category;
}

export function buildFlyerEyebrow(brief: BriefLike): string | null {
  if (brief.displayOptions.showTagline && brief.tagline?.trim()) {
    return brief.tagline
      .split(/[,|/]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" • ");
  }
  if (isDesignBrief(brief) && brief.primaryCategory) {
    return brief.primaryCategory;
  }
  if (brief.categories.length > 0) {
    return brief.categories.slice(0, 2).join(" · ");
  }
  return brief.industry || null;
}
