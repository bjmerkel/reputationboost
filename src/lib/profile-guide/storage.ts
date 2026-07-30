import { createClient } from "@/lib/supabase/server";
import { buildDefaultProfileGuideLinks } from "./defaults";
import { buildProfileGuideSlug } from "./slug";
import type {
  ProfileGuideLinkInput,
  ProfileGuideLinkRecord,
  ProfileGuideRecord,
  ProfileGuideUpdateInput,
  ProfileGuideWithLinks,
} from "./types";

function formatStorageError(message: string): string {
  if (
    message.includes("Could not find the table") ||
    message.includes('relation "public.profile_guides" does not exist')
  ) {
    return "Profile Guide tables not found. Run migration 047_profile_guides.sql in Supabase.";
  }
  return message;
}

function rowToGuide(row: Record<string, unknown>): ProfileGuideRecord {
  return row as unknown as ProfileGuideRecord;
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

export async function getOrCreateProfileGuide(
  userId: string,
  business: import("@/audit/types").ClientConfig
): Promise<ProfileGuideWithLinks> {
  if (!business.businessId) {
    throw new Error("No business configured");
  }

  const existing = await getProfileGuideByBusinessId(userId, business.businessId);
  if (existing) return existing;

  const supabase = await createClient();
  const slug = buildProfileGuideSlug(business.name, business.businessId!);
  const defaultLinks = buildDefaultProfileGuideLinks(business);

  const { data: guide, error } = await supabase
    .from("profile_guides")
    .insert({
      business_id: business.businessId,
      user_id: userId,
      slug,
      display_name: business.name,
      primary_color: "#1a73e8",
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
  input: ProfileGuideUpdateInput
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
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  if (input.tagline !== undefined) patch.tagline = input.tagline;
  if (input.published !== undefined) {
    patch.published = input.published;
    patch.published_at = input.published ? new Date().toISOString() : null;
  }

  const { data: guide, error } = await supabase
    .from("profile_guides")
    .update(patch)
    .eq("id", current.guide.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(formatStorageError(error.message));

  if (input.links) {
    for (const link of input.links) {
      if (!link.id) continue;
      const { error: linkError } = await supabase
        .from("profile_guide_links")
        .update({
          label: link.label,
          url: link.url,
          sort_order: link.sortOrder,
          enabled: link.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id)
        .eq("guide_id", current.guide.id);

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
