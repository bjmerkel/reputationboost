const LEGACY_SLUG_SUFFIX = /-[a-f0-9]{8}$/i;
const MAX_SLUG_LENGTH = 48;

export function slugifyProfileGuideName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

function normalizeSlugCandidate(candidate: string): string {
  return candidate.replace(/^-|-$/g, "").slice(0, MAX_SLUG_LENGTH);
}

export function profileGuideSlugCandidates(name: string): string[] {
  const base = slugifyProfileGuideName(name) || "business";
  const seen = new Set<string>();
  const candidates: string[] = [];

  function add(candidate: string) {
    const normalized = normalizeSlugCandidate(candidate);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  }

  add(base);

  const parts = base.split("-");
  if (parts.length > 1) {
    add(parts.join(""));

    for (let index = 0; index < parts.length - 1; index += 1) {
      const merged = [
        ...parts.slice(0, index),
        `${parts[index]}${parts[index + 1]}`,
        ...parts.slice(index + 2),
      ];
      add(merged.join("-"));
    }
  }

  return candidates;
}

export function profileGuideSlugFallbackCandidates(baseSlug: string, max = 20): string[] {
  const fallbacks: string[] = [];
  for (let suffix = 2; suffix <= max + 1; suffix += 1) {
    const candidate = normalizeSlugCandidate(`${baseSlug}-${suffix}`);
    if (candidate && candidate !== baseSlug) {
      fallbacks.push(candidate);
    }
  }
  return fallbacks;
}

export function allProfileGuideSlugCandidates(name: string): string[] {
  const primary = profileGuideSlugCandidates(name);
  const base = primary[0] ?? "business";
  const seen = new Set(primary);
  const all = [...primary];

  for (const candidate of profileGuideSlugFallbackCandidates(base)) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    all.push(candidate);
  }

  return all;
}

export function buildProfileGuideSlug(name: string): string {
  return profileGuideSlugCandidates(name)[0] ?? "business";
}

export function hasLegacyProfileGuideSlug(slug: string): boolean {
  return LEGACY_SLUG_SUFFIX.test(slug);
}

export function profileGuideSlugWithoutLegacySuffix(slug: string): string {
  return slug.replace(LEGACY_SLUG_SUFFIX, "");
}

export function profileGuidePublicPath(slug: string): string {
  return `/g/${slug}`;
}

export function profileGuidePublicUrl(slug: string, origin?: string): string {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${profileGuidePublicPath(slug)}`;
}
