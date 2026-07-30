export function slugifyProfileGuideName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildProfileGuideSlug(name: string, businessId: string): string {
  const base = slugifyProfileGuideName(name) || "business";
  const suffix = businessId.replace(/-/g, "").slice(0, 8);
  return `${base}-${suffix}`;
}

export function profileGuidePublicPath(slug: string): string {
  return `/g/${slug}`;
}

export function profileGuidePublicUrl(slug: string, origin?: string): string {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${profileGuidePublicPath(slug)}`;
}
