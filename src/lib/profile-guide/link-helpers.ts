export const MAX_CUSTOM_PROFILE_GUIDE_LINKS = 10;

export function isNewProfileGuideLinkId(id?: string): boolean {
  return !id || id.startsWith("new-");
}

export function countCustomProfileGuideLinks(
  links: Array<{ link_type?: string; linkType?: string }>
): number {
  return links.filter((link) => (link.link_type ?? link.linkType) === "custom").length;
}
