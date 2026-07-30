import type { ClientConfig } from "@/audit/types";
import { buildTextUsUrl } from "./theme";
import {
  buildBusinessAddress,
  buildDefaultProfileGuideLinks,
} from "./defaults";
import type { ProfileGuideLinkRecord, ProfileGuideWithLinks } from "./types";

export function applyTextMessageToLinks(
  links: ProfileGuideLinkRecord[],
  phone: string | null | undefined,
  textMessage: string | null | undefined
): ProfileGuideLinkRecord[] {
  if (!phone?.trim()) return links;
  const smsUrl = buildTextUsUrl(phone, textMessage);
  return links.map((link) =>
    link.link_type === "text" ? { ...link, url: smsUrl, enabled: Boolean(smsUrl) } : link
  );
}

export function buildSyncedLinkUpdates(
  business: ClientConfig,
  existingLinks: ProfileGuideLinkRecord[],
  options: { bookUrl?: string | null; textMessage?: string | null } = {}
): Array<{ id: string; url: string; enabled: boolean }> {
  const defaults = buildDefaultProfileGuideLinks(business, options);
  const defaultByType = new Map(defaults.map((link) => [link.linkType, link]));

  return existingLinks
    .filter((link) => link.link_type !== "custom")
    .map((link) => {
      const fresh = defaultByType.get(link.link_type);
      if (!fresh) return { id: link.id, url: link.url, enabled: link.enabled };

      let url = fresh.url;
      if (link.link_type === "text" && business.phone) {
        url = buildTextUsUrl(business.phone, options.textMessage);
      }

      return {
        id: link.id,
        url,
        enabled: Boolean(url),
      };
    });
}

export function shouldAutoSyncGuide(gbpSyncedAt: string | null | undefined): boolean {
  if (!gbpSyncedAt) return true;
  const synced = new Date(gbpSyncedAt).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Date.now() - synced > dayMs;
}

export function mergeSyncedGuide(
  guide: ProfileGuideWithLinks,
  business: ClientConfig,
  options: { bookUrl?: string | null; textMessage?: string | null } = {}
): ProfileGuideWithLinks {
  const updates = buildSyncedLinkUpdates(business, guide.links, options);
  const updateById = new Map(updates.map((row) => [row.id, row]));

  return {
    guide: {
      ...guide.guide,
      display_name: business.name,
    },
    links: guide.links.map((link) => {
      const patch = updateById.get(link.id);
      if (!patch) return link;
      return { ...link, url: patch.url, enabled: patch.enabled };
    }),
  };
}

export function businessAddressFromConfig(business: ClientConfig): string {
  return buildBusinessAddress(business);
}
