import type { FullAuditPayload, GbpMediaPreview } from "@/audit/types";
import type { ClientConfig } from "@/audit/types";
import { loadLatestAuditForBusinessAdmin } from "@/audit/storage-supabase-admin";
import type { ProfileGuideWithLinks } from "../types";
import {
  getArchetypeDefinition,
  resolveFlyerDesignArchetype,
  type ArchetypeDefinition,
  type FlyerDesignArchetype,
} from "./archetypes";
import { buildFlyerBrief, type FlyerBrief } from "./brief";
import {
  extractFlyerGbpPhotos,
  selectFlyerCoverPhoto,
  type FlyerGbpPhoto,
} from "./photo-picker";

export interface FlyerDesignBrief extends FlyerBrief {
  primaryCategory: string;
  description?: string | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  profileGuideActions: string[];
  photoUrls: string[];
  gbpPhotos: FlyerGbpPhoto[];
  selectedCoverUrl?: string | null;
  resolvedCoverUrl: string | null;
  archetype: FlyerDesignArchetype;
  archetypeStyle: ArchetypeDefinition;
}

export interface FlyerGbpEnrichment {
  primaryCategory?: string;
  description?: string | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  photoUrls?: string[];
  mediaPreviews?: GbpMediaPreview[];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

export function extractFlyerGbpEnrichment(
  audit: FullAuditPayload | null | undefined
): FlyerGbpEnrichment {
  if (!audit?.gbp) return {};

  const mediaPreviews = audit.gbp.content.mediaPreviews ?? [];
  const gbpPhotos = extractFlyerGbpPhotos(mediaPreviews);
  const mediaUrls = gbpPhotos.map((photo) => photo.url);

  return {
    primaryCategory: audit.gbp.identity.primaryCategory || undefined,
    description: audit.gbp.liveProfile?.description ?? null,
    averageRating: audit.gbp.engagement.averageRating ?? null,
    reviewCount: audit.gbp.engagement.reviewCount ?? null,
    photoUrls: mediaUrls.slice(0, 6),
    mediaPreviews,
  };
}

export function buildProfileGuideActions(guide: ProfileGuideWithLinks): string[] {
  return guide.links
    .filter((link) => link.enabled)
    .map((link) => link.label.trim())
    .filter(Boolean);
}

export function buildFlyerDesignBrief(input: {
  guide: ProfileGuideWithLinks;
  business: ClientConfig;
  publicUrl: string;
  template: FlyerBrief["template"];
  format: FlyerBrief["format"];
  displayOptions?: FlyerBrief["displayOptions"];
  enrichment?: FlyerGbpEnrichment;
  archetypeOverride?: FlyerDesignArchetype | null;
  selectedCoverUrl?: string | null;
}): FlyerDesignBrief {
  const brief = buildFlyerBrief(
    input.guide,
    input.business,
    input.publicUrl,
    input.template,
    input.format,
    input.displayOptions
  );

  const enrichment = input.enrichment ?? {};
  const primaryCategory =
    enrichment.primaryCategory?.trim() ||
    brief.categories[0]?.trim() ||
    brief.industry;
  const gbpPhotos = extractFlyerGbpPhotos(enrichment.mediaPreviews);
  const photoUrls = uniqueStrings([
    brief.coverImageUrl,
    ...(enrichment.photoUrls ?? gbpPhotos.map((photo) => photo.url)),
  ]).slice(0, 6);
  const detectedArchetype = resolveFlyerDesignArchetype({
    primaryCategory,
    industry: brief.industry,
    categories: brief.categories,
    keywords: brief.keywords,
  });
  const archetype = input.archetypeOverride ?? detectedArchetype;
  const resolvedCoverUrl = selectFlyerCoverPhoto({
    archetype,
    photos: gbpPhotos,
    guideCoverUrl: brief.coverImageUrl,
    selectedCoverUrl: input.selectedCoverUrl,
  });

  return {
    ...brief,
    primaryCategory,
    description: enrichment.description ?? null,
    averageRating: enrichment.averageRating ?? null,
    reviewCount: enrichment.reviewCount ?? null,
    profileGuideActions: buildProfileGuideActions(input.guide),
    photoUrls,
    gbpPhotos,
    selectedCoverUrl: input.selectedCoverUrl ?? null,
    resolvedCoverUrl,
    archetype,
    archetypeStyle: getArchetypeDefinition(archetype),
  };
}

export async function loadFlyerGbpEnrichment(input: {
  userId: string;
  business: ClientConfig;
}): Promise<FlyerGbpEnrichment> {
  if (!input.business.businessId) return {};

  try {
    const audit = await loadLatestAuditForBusinessAdmin(
      input.userId,
      input.business.businessId,
      input.business.id,
      input.business.name
    );
    return extractFlyerGbpEnrichment(audit);
  } catch {
    return {};
  }
}

export async function buildFlyerDesignBriefWithEnrichment(input: {
  userId: string;
  guide: ProfileGuideWithLinks;
  business: ClientConfig;
  publicUrl: string;
  template: FlyerBrief["template"];
  format: FlyerBrief["format"];
  displayOptions?: FlyerBrief["displayOptions"];
  archetypeOverride?: FlyerDesignArchetype | null;
  selectedCoverUrl?: string | null;
}): Promise<FlyerDesignBrief> {
  const enrichment = await loadFlyerGbpEnrichment({
    userId: input.userId,
    business: input.business,
  });

  return buildFlyerDesignBrief({
    ...input,
    enrichment,
  });
}
