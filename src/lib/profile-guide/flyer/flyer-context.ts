import type { ClientConfig } from "@/audit/types";
import type { ProfileGuideWithLinks } from "../types";
import {
  getArchetypeDefinition,
  resolveFlyerDesignArchetype,
  type FlyerDesignArchetype,
} from "./archetypes";
import { buildFlyerBrief } from "./brief";
import {
  buildFlyerDesignBrief,
  loadFlyerGbpEnrichment,
  type FlyerGbpEnrichment,
} from "./design-brief";
import { extractFlyerGbpPhotos, selectFlyerCoverPhoto, type FlyerGbpPhoto } from "./photo-picker";

export interface FlyerStudioContext {
  photos: FlyerGbpPhoto[];
  detectedArchetype: FlyerDesignArchetype;
  detectedArchetypeLabel: string;
  primaryCategory: string;
  resolvedCoverUrl: string | null;
}

export function buildFlyerStudioContext(input: {
  guide: ProfileGuideWithLinks;
  business: ClientConfig;
  publicUrl: string;
  enrichment?: FlyerGbpEnrichment;
  archetypeOverride?: FlyerDesignArchetype | null;
  selectedCoverUrl?: string | null;
}): FlyerStudioContext {
  const brief = buildFlyerBrief(
    input.guide,
    input.business,
    input.publicUrl,
    "professional",
    "letter"
  );
  const enrichment = input.enrichment ?? {};
  const primaryCategory =
    enrichment.primaryCategory?.trim() ||
    brief.categories[0]?.trim() ||
    brief.industry;
  const detectedArchetype = resolveFlyerDesignArchetype({
    primaryCategory,
    industry: brief.industry,
    categories: brief.categories,
    keywords: brief.keywords,
  });
  const archetype = input.archetypeOverride ?? detectedArchetype;
  const photos = extractFlyerGbpPhotos(enrichment.mediaPreviews);
  const resolvedCoverUrl = selectFlyerCoverPhoto({
    archetype,
    photos,
    guideCoverUrl: brief.coverImageUrl,
    selectedCoverUrl: input.selectedCoverUrl,
  });

  return {
    photos,
    detectedArchetype,
    detectedArchetypeLabel: getArchetypeDefinition(detectedArchetype).label,
    primaryCategory,
    resolvedCoverUrl,
  };
}

export async function loadFlyerStudioContext(input: {
  userId: string;
  guide: ProfileGuideWithLinks;
  business: ClientConfig;
  publicUrl: string;
  archetypeOverride?: FlyerDesignArchetype | null;
  selectedCoverUrl?: string | null;
}): Promise<FlyerStudioContext> {
  const enrichment = await loadFlyerGbpEnrichment({
    userId: input.userId,
    business: input.business,
  });

  return buildFlyerStudioContext({
    ...input,
    enrichment,
  });
}
