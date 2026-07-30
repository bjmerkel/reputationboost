import { createClient } from "@/lib/supabase/server";
import type { ClientConfig } from "@/audit/types";
import { buildDefaultProfileGuideLinks } from "./defaults";
import { buildProfileGuideSlug } from "./slug";
import { mergeSyncedGuide, shouldAutoSyncGuide } from "./sync";
import type {
  ProfileGuideLinkInput,
  ProfileGuideLinkRecord,
  ProfileGuideRecord,
  ProfileGuideUpdateInput,
  ProfileGuideWithLinks,
} from "./types";
import { buildTextUsUrl } from "./theme";

function formatStorageError(message: string): string {
  if (
    message.includes("Could not find the table") ||
    message.includes('relation "public.profile_guides" does not exist')
  ) {
    return "Profile Guide tables not found. Run migration 047_profile_guides.sql in Supabase.";
  }
  if (message.includes("background_color") || message.includes("gbp_synced_at")) {
    return "Profile Guide Phase 2 columns not found. Run migration 048_profile_guide_phase2.sql in Supabase.";
  }
  return message;
}

function rowToGuide(row: Record<string, unknown>): ProfileGuideRecord {
  return {
    ...(row as unknown as ProfileGuideRecord),
    background_color: (row.background_color as string) ?? "#f8f9fa",
    button_style: (row.button_style as ProfileGuideRecord["button_style"]) ?? "rounded",
    font_preset: (row.font_preset as ProfileGuideRecord["font_preset"]) ?? "professional",
    text_message: (row.text_message as string | null) ?? null,
    gbp_synced_at: (row.gbp_synced_at as string | null) ?? null,
  };
}

function rowToLink(row: Record<string, unknown>): ProfileGuideLinkRecord {
  return row as unknown as ProfileGuideLinkRecord;
}

async function insertDefaultLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guideId: string,
  links: ProfileGuideLinkInput[]
): Promise<ProfileGuideLinkRecord[]> {
  const payload = links.map((link) => ({
    guide_id: guideId,
    link_type: link.linkType,
    label: link.label,
    url: link.url,
    sort_order: link.sortOrder,
    enabled: link.enabled,
  }));

  const { data, error } = await supabase
    .from("profile_guide_links")
    .insert(payload)
    .select("*");

  if (error) throw new Error(formatStorageError(error.message));
  return (data ?? []).map(rowToLink);
}

export async function getProfileGuideByBusinessId(
  userId: string,
  businessId: string
): Promise<ProfileGuideWithLinks | null> {
  const supabase = await createClient();
  const { data: guide, error } = await supabase
    .from("profile_guides")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(formatStorageError(error.message));
  if (!guide) return null;

  const { data: links, error: linksError } = await supabase
    .from("profile_guide_links")
    .select("*")
    .eq("guide_id", guide.id)
    .order("sort_order", { ascending: true });

  if (linksError) throw new Error(formatStorageError(linksError.message));

  return {
    guide: rowToGuide(guide),
    links: (links ?? []).map(rowToLink),
  };
}

async function persistSyncedGuide(
  userId: string,
  businessId: string,
  synced: ProfileGuideWithLinks
): Promise<ProfileGuideWithLinks> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: guideError } = await supabase
    .from("profile_guides")
    .update({
      display_name: synced.guide.display_name,
      gbp_synced_at: now,
      updated_at: now,
    })
    .eq("id", synced.guide.id)
    .eq("user_id", userId);

  if (guideError) throw new Error(formatStorageError(guideError.message));

  for (const link of synced.links) {
    const { error } = await supabase
      .from("profile_guide_links")
      .update({
        url: link.url,
        enabled: link.enabled,
        updated_at: now,
      })
      .eq("id", link.id)
      .eq("guide_id", synced.guide.id);

    if (error) throw new Error(formatStorageError(error.message));
  }

  const refreshed = await getProfileGuideByBusinessId(userId, businessId);
  if (!refreshed) throw new Error("Failed to reload Profile Guide after sync");
  return refreshed;
}

export async function syncProfileGuideFromBusiness(
  userId: string,
  business: ClientConfig,
  options: { force?: boolean } = {}
): Promise<ProfileGuideWithLinks> {
  if (!business.businessId) throw new Error("No business configured");

  const current = await getProfileGuideByBusinessId(userId, business.businessId);
  if (!current) throw new Error("Profile Guide not found");

  if (!options.force && !shouldAutoSyncGuide(current.guide.gbp_synced_at)) {
    return current;
  }

  const synced = mergeSyncedGuide(current, business, {
    textMessage: current.guide.text_message,
  });

  return persistSyncedGuide(userId, business.businessId, synced);
}

export async function getOrCreateProfileGuide(
  userId: string,
  business: ClientConfig
): Promise<ProfileGuideWithLinks> {
  if (!business.businessId) {
    throw new Error("No business configured");
  }

  const existing = await getProfileGuideByBusinessId(userId, business.businessId);
  if (existing) {
    if (shouldAutoSyncGuide(existing.guide.gbp_synced_at)) {
      return syncProfileGuideFromBusiness(userId, business, { force: true });
    }
    return existing;
  }

  const supabase = await createClient();
  const slug = buildProfileGuideSlug(business.name, business.businessId);
  const defaultLinks = buildDefaultProfileGuideLinks(business);

  const { data: guide, error } = await supabase
    .from("profile_guides")
    .insert({
      business_id: business.businessId,
      user_id: userId,
      slug,
      display_name: business.name,
      primary_color: "#1a73e8",
      gbp_synced_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(formatStorageError(error.message));

  const links = await insertDefaultLinks(supabase, guide.id, defaultLinks);
  return { guide: rowToGuide(guide), links };
}

export async function updateProfileGuide(
  userId: string,
  businessId: string,
  input: ProfileGuideUpdateInput,
  business?: ClientConfig
): Promise<ProfileGuideWithLinks> {
  const current = await getProfileGuideByBusinessId(userId, businessId);
  if (!current) {
    throw new Error("Profile Guide not found");
  }

  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.primaryColor !== undefined) patch.primary_color = input.primaryColor;
  if (input.backgroundColor !== undefined) patch.background_color = input.backgroundColor;
  if (input.buttonStyle !== undefined) patch.button_style = input.buttonStyle;
  if (input.fontPreset !== undefined) patch.font_preset = input.fontPreset;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  if (input.tagline !== undefined) patch.tagline = input.tagline;
  if (input.textMessage !== undefined) patch.text_message = input.textMessage;
  if (input.published !== undefined) {
    patch.published = input.published;
    patch.published_at = input.published ? new Date().toISOString() : null;
  }

  const { error } = await supabase
    .from("profile_guides")
    .update(patch)
    .eq("id", current.guide.id)
    .eq("user_id", userId);

  if (error) throw new Error(formatStorageError(error.message));

  const textMessage = input.textMessage !== undefined ? input.textMessage : current.guide.text_message;
  const phone = business?.phone;

  if (input.links) {
    for (const link of input.links) {
      if (!link.id) continue;
      let url = link.url;
      if (link.linkType === "text" && phone?.trim()) {
        url = buildTextUsUrl(phone, textMessage);
      }

      const { error: linkError } = await supabase
        .from("profile_guide_links")
        .update({
          label: link.label,
          url,
          sort_order: link.sortOrder,
          enabled: link.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id)
        .eq("guide_id", current.guide.id);

      if (linkError) throw new Error(formatStorageError(linkError.message));
    }
  } else if (input.textMessage !== undefined && phone?.trim()) {
    const textLink = current.links.find((link) => link.link_type === "text");
    if (textLink) {
      const url = buildTextUsUrl(phone, textMessage);
      const { error: linkError } = await supabase
        .from("profile_guide_links")
        .update({
          url,
          enabled: Boolean(url),
          updated_at: new Date().toISOString(),
        })
        .eq("id", textLink.id);

      if (linkError) throw new Error(formatStorageError(linkError.message));
    }
  }

  const refreshed = await getProfileGuideByBusinessId(userId, businessId);
  if (!refreshed) throw new Error("Failed to reload Profile Guide");
  return refreshed;
}

export async function getPublishedProfileGuideBySlug(
  slug: string
): Promise<ProfileGuideWithLinks | null> {
  const supabase = await createClient();
  const { data: guide, error } = await supabase
    .from("profile_guides")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) throw new Error(formatStorageError(error.message));
  if (!guide) return null;

  const { data: links, error: linksError } = await supabase
    .from("profile_guide_links")
    .select("*")
    .eq("guide_id", guide.id)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  if (linksError) throw new Error(formatStorageError(linksError.message));

  return {
    guide: rowToGuide(guide),
    links: (links ?? []).map(rowToLink),
  };
}

export async function getProfileGuidePublicUrlForBusiness(
  userId: string,
  businessId: string,
  origin?: string
): Promise<string | null> {
  const guide = await getProfileGuideByBusinessId(userId, businessId);
  if (!guide) return null;
  const { profileGuidePublicUrl } = await import("./slug");
  return profileGuidePublicUrl(guide.guide.slug, origin);
}
